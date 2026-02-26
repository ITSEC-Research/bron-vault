import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { chunkManager } from "@/lib/upload/chunk-manager"
import { createReadStream, createWriteStream } from "fs"
import { unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { pipeline } from "stream/promises"
import { mkdir } from "fs/promises"
import { processFileUploadFromPath } from "@/lib/upload/file-upload-processor"
import { broadcastLogToSession, closeLogSession } from "@/lib/upload-connections"
import { createImportLog, updateImportLog, logUploadAction } from "@/lib/audit-log"
import { v4 as uuidv4 } from "uuid"

/**
 * POST /api/upload-assemble
 * Assemble chunks into complete file
 */
export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  // Check admin role - analysts cannot upload data
  const roleError = requireAdminRole(user)
  if (roleError) {
    return roleError
  }

  try {
    const body = await request.json()
    const { fileId, fileName, sessionId } = body

    if (!fileId || !fileName) {
      return NextResponse.json(
        { success: false, error: "fileId and fileName are required" },
        { status: 400 }
      )
    }

    // Get chunk metadata
    let metadata = chunkManager.getChunkMetadata(fileId)
    
    // If metadata not found in memory (e.g., after hot-reload), try to reconstruct from disk
    if (!metadata) {
      console.log(`⚠️ [ASSEMBLE] Metadata not found in memory for ${fileId}, attempting to reconstruct from disk...`)
      
      // Get all chunk files from disk
      const chunkPaths = await chunkManager.getAllChunkPaths(fileId)
      if (chunkPaths.length === 0) {
        return NextResponse.json(
          { success: false, error: "File upload not found - no chunks on disk" },
          { status: 404 }
        )
      }
      
      // Calculate total file size by summing all chunk sizes
      const { stat } = await import("fs/promises")
      let totalFileSize = 0
      for (const chunkPath of chunkPaths) {
        const chunkStats = await stat(chunkPath)
        totalFileSize += chunkStats.size
      }
      
      const totalChunks = chunkPaths.length
      
      console.log(`📦 [ASSEMBLE] Reconstructed metadata from disk: ${totalChunks} chunks, ${totalFileSize} bytes total`)
      
      // Reconstruct metadata by initializing it and marking all chunks as uploaded
      metadata = chunkManager.initializeChunk(fileId, fileName, totalFileSize, totalChunks, sessionId || "unknown")
      // Mark all chunks as uploaded (since they're all on disk)
      for (let i = 0; i < totalChunks; i++) {
        chunkManager.markChunkUploaded(fileId, i)
      }
      
      console.log(`✅ [ASSEMBLE] Metadata reconstructed and stored in memory`)
    }

    // Verify all chunks are uploaded
    const allUploaded = await chunkManager.areAllChunksUploaded(fileId)
    if (!allUploaded) {
      const uploadedChunks = await chunkManager.getUploadedChunkIndices(fileId)
      return NextResponse.json(
        {
          success: false,
          error: "Not all chunks are uploaded",
          uploaded: uploadedChunks.length,
          total: metadata.totalChunks,
        },
        { status: 400 }
      )
    }

    // Get all chunk paths (sorted by index)
    const chunkPaths = await chunkManager.getAllChunkPaths(fileId)
    console.log(`🔧 [ASSEMBLE] Found ${chunkPaths.length} chunk files, expected ${metadata.totalChunks}`)
    
    if (chunkPaths.length !== metadata.totalChunks) {
      return NextResponse.json(
        {
          success: false,
          error: "Chunk count mismatch",
          found: chunkPaths.length,
          expected: metadata.totalChunks,
        },
        { status: 400 }
      )
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads")
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // SECURITY: Sanitize fileName to prevent path traversal
    const safeFileName = path.basename(fileName)
    const assembledFilePath = path.join(uploadsDir, safeFileName)
    // Verify resolved path is within uploads directory
    if (!path.resolve(assembledFilePath).startsWith(path.resolve(uploadsDir))) {
      return NextResponse.json(
        { success: false, error: "Invalid filename" },
        { status: 400 }
      )
    }
    console.log(`🔧 [ASSEMBLE] Assembling ${chunkPaths.length} chunks into: ${assembledFilePath}`)

    // Stream chunks sequentially to final file
    const writeStream = createWriteStream(assembledFilePath)
    
    // Set max listeners to prevent MaxListenersExceededWarning
    // Each pipeline() call adds multiple event listeners (error, close, finish, end)
    // Set to accommodate all chunks plus a buffer
    writeStream.setMaxListeners(chunkPaths.length * 4 + 10)

    for (let i = 0; i < chunkPaths.length; i++) {
      const chunkPath = chunkPaths[i]
      console.log(`📦 [ASSEMBLE] Merging chunk ${i + 1}/${chunkPaths.length}: ${path.basename(chunkPath)}`)
      const readStream = createReadStream(chunkPath)
      await pipeline(readStream, writeStream, { end: false })
    }

    writeStream.end()
    console.log(`✅ [ASSEMBLE] File assembly completed`)

    // Verify file size
    const { stat } = await import("fs/promises")
    const stats = await stat(assembledFilePath)
    if (stats.size !== metadata.fileSize) {
      // Clean up assembled file
      await unlink(assembledFilePath)
      return NextResponse.json(
        {
          success: false,
          error: "File size mismatch after assembly",
          expected: metadata.fileSize,
          actual: stats.size,
        },
        { status: 500 }
      )
    }

    // Clean up chunk files
    await chunkManager.cleanupChunks(fileId)

    // Generate a unique job ID for this import
    const jobId = `web-chunk-${uuidv4().substring(0, 8)}`
    const startedAt = new Date()

    // Log the upload start in audit log
    await logUploadAction(
      'upload.start',
      { id: Number(user.userId), email: user.email || null },
      jobId,
      { filename: fileName, file_size: stats.size, upload_type: 'chunked' },
      request
    )

    // Create import log with pending status BEFORE processing starts
    await createImportLog({
      job_id: jobId,
      user_id: Number(user.userId),
      user_email: user.email || null,
      api_key_id: null,
      source: 'web',
      filename: fileName,
      file_size: stats.size,
      status: 'pending',
      total_devices: 0,
      processed_devices: 0,
      total_credentials: 0,
      total_files: 0,
      error_message: null,
      started_at: null,
      completed_at: null
    })

    // Update to processing status when processing starts
    await updateImportLog(jobId, {
      status: 'processing',
      started_at: startedAt,
    })

    // Process the assembled file (same processing logic as regular upload)
    // This uses the EXACT SAME processing functions - no changes to parsing logic
    let lastProgress = 0
    const logWithBroadcast = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
      console.log(message)
      broadcastLogToSession(sessionId, message, type)
      
      // Check for progress updates in log messages
      const progressMatch = message.match(/\[PROGRESS\]\s*(\d+)\/(\d+)/)
      if (progressMatch) {
        const current = parseInt(progressMatch[1], 10)
        const total = parseInt(progressMatch[2], 10)
        if (total > 0) {
          const progressPercent = Math.min(99, Math.floor((current / total) * 100))
          if (progressPercent > lastProgress) {
            lastProgress = progressPercent
            // Update import log with progress (non-blocking)
            updateImportLog(jobId, {
              processed_devices: current,
              total_devices: total,
            }).catch(err => console.error('Failed to update import log progress:', err))
          }
        }
      }
    }

    logWithBroadcast("📦 File assembled successfully, starting processing...", "info")

    // Process file from path (this will use the same processZipWithBinaryStorage function)
    logWithBroadcast("🔄 Starting file processing...", "info")
    let processingResult
    try {
      processingResult = await processFileUploadFromPath(
        assembledFilePath,
        fileName,
        sessionId,
        logWithBroadcast,
        true // Delete file after processing
      )
    } catch (processError) {
      const errorMsg = processError instanceof Error ? processError.message : String(processError)
      logWithBroadcast(`❌ Processing threw an error: ${errorMsg}`, "error")
      
      // Update import log for error - AFTER processing failed
      await updateImportLog(jobId, {
        status: 'failed',
        error_message: errorMsg,
        completed_at: new Date()
      })

      // Log the upload failure in audit log
      await logUploadAction(
        'upload.fail',
        { id: Number(user.userId), email: user.email || null },
        jobId,
        { error: errorMsg },
        request
      )

      // Close log session before returning error
      setTimeout(() => closeLogSession(sessionId), 1000)
      
      return NextResponse.json(
        {
          success: false,
          error: "Processing failed",
          details: errorMsg,
          errorType: processError instanceof Error ? processError.constructor.name : "Unknown",
        },
        { status: 500 }
      )
    }

    // Close log session
    setTimeout(() => closeLogSession(sessionId), 1000)

    if (processingResult.success) {
      // Update import log with complete data AFTER processing is done
      // Note: processingResult.details contains devicesFound, devicesProcessed from zip processor
      await updateImportLog(jobId, {
        status: 'completed',
        total_devices: processingResult.details?.devicesFound || 0,
        processed_devices: processingResult.details?.devicesProcessed || 0,
        total_credentials: processingResult.details?.totalCredentials || 0,
        total_files: processingResult.details?.totalFiles || 0,
        completed_at: new Date()
      })

      // Log the upload completion in audit log
      await logUploadAction(
        'upload.complete',
        { id: Number(user.userId), email: user.email || null },
        jobId,
        { 
          total_devices: processingResult.details?.devicesFound || 0,
          total_credentials: processingResult.details?.totalCredentials || 0,
          total_files: processingResult.details?.totalFiles || 0
        },
        request
      )

      return NextResponse.json({
        success: true,
        fileName: safeFileName,
        fileSize: stats.size,
        details: processingResult.details,
        message: "File assembled and processed successfully",
      })
    } else {
      // Update import log for failed processing
      await updateImportLog(jobId, {
        status: 'failed',
        error_message: processingResult.error || 'Unknown error',
        completed_at: new Date()
      })

      // Log the upload failure in audit log
      await logUploadAction(
        'upload.fail',
        { id: Number(user.userId), email: user.email || null },
        jobId,
        { error: processingResult.error || 'Unknown error' },
        request
      )

      logWithBroadcast(`❌ Processing returned failure: ${processingResult.error}`, "error")
      return NextResponse.json(
        {
          success: false,
          error: "Processing failed",
          details: processingResult.error || "Unknown error",
        },
        { status: 500 }
      )
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error("Error assembling file:", error)
    if (errorStack) {
      console.error("Error stack:", errorStack)
    }
    
    // Try to broadcast error to session if sessionId is available
    try {
      const body = await request.json().catch(() => ({}))
      const sessionId = body.sessionId
      if (sessionId) {
        broadcastLogToSession(sessionId, `❌ Assembly error: ${errorMessage}`, "error")
        if (errorStack) {
          broadcastLogToSession(sessionId, `📋 Error details: ${errorStack.substring(0, 500)}...`, "error")
        }
        setTimeout(() => closeLogSession(sessionId), 1000)
      }
    } catch (_broadcastError) {
      // Ignore broadcast errors
    }
    
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        errorType: error instanceof Error ? error.constructor.name : "Unknown",
      },
      { status: 500 }
    )
  }
}

