import { writeFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { initializeDatabase } from "@/lib/mysql"
// Import versi streaming (untuk file besar)
import { processZipStream } from "./zip-processor-stream"
// Import versi original (untuk backward compatibility dengan file kecil)
import { processZipWithBinaryStorage } from "./zip-processor"

export interface FileUploadResult {
  success: boolean
  details?: any
  error?: string
}

/**
 * Process file upload from File object (original method - backward compatible)
 */
export async function processFileUpload(
  file: File,
  sessionId: string,
  logWithBroadcast: (message: string, type?: "info" | "success" | "warning" | "error") => void,
): Promise<FileUploadResult> {
  let uploadedFilePath: string | null = null

  try {
    await initializeDatabase()

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return {
        success: false,
        error: "Only .zip files are allowed",
      }
    }

    logWithBroadcast("📦 File received: " + file.name + " Size: " + file.size, "info")

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "uploads")
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }

    // Save uploaded file temporarily
    const bytes = await file.arrayBuffer()
    const buffer = new Uint8Array(bytes)
    uploadedFilePath = path.join(uploadsDir, file.name)
    await writeFile(uploadedFilePath, buffer)

    // Process using the file path method (reuse logic)
    return await processFileUploadFromPath(
      uploadedFilePath,
      file.name,
      sessionId,
      logWithBroadcast,
      true // deleteAfterProcessing = true (original behavior)
    )
  } catch (error) {
    logWithBroadcast("💥 Upload processing error:" + error, "error")

    // CLEANUP: Delete the uploaded ZIP file on error too
    if (uploadedFilePath) {
      try {
        await unlink(uploadedFilePath)
        logWithBroadcast(`🗑️ Cleaned up ZIP file after error: ${uploadedFilePath}`, "info")
      } catch (cleanupError) {
        logWithBroadcast(`⚠️ Failed to cleanup ZIP file after error: ${cleanupError}`, "warning")
      }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Process file upload from file path (new method for chunked uploads)
 * This allows processing files that were assembled from chunks
 * 
 * @param filePath - Path to the uploaded ZIP file on disk
 * @param fileName - Original file name
 * @param sessionId - Upload session ID
 * @param logWithBroadcast - Logging function
 * @param deleteAfterProcessing - Whether to delete the file after processing (default: false for chunked uploads)
 */
export async function processFileUploadFromPath(
  filePath: string,
  fileName: string,
  sessionId: string,
  logWithBroadcast: (message: string, type?: "info" | "success" | "warning" | "error") => void,
  deleteAfterProcessing: boolean = false,
): Promise<FileUploadResult> {
  try {
    await initializeDatabase()

    if (!fileName.toLowerCase().endsWith(".zip")) {
      return {
        success: false,
        error: "Only .zip files are allowed",
      }
    }

    // Check if file exists
    if (!existsSync(filePath)) {
      return {
        success: false,
        error: "File not found at path: " + filePath,
      }
    }

    // Get file size check only
    const { stat } = await import("fs/promises")
    const stats = await stat(filePath)
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2)
    
    // Generate unique upload batch ID
    const uploadBatch = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
    logWithBroadcast(`🆔 Upload batch ID: ${uploadBatch}`, "info")

    // --- PERUBAHAN UTAMA DI SINI ---
    // Kita TIDAK melakukan readFile ke memory.
    // Kita langsung panggil processor streaming dengan filePath.
    
    // Threshold untuk menggunakan streaming vs JSZip
    // File > 500MB akan menggunakan streaming (yauzl)
    // File <= 500MB akan menggunakan JSZip (backward compatibility)
    const STREAMING_THRESHOLD_MB = 500
    const fileSizeMBNum = parseFloat(fileSizeMB)
    
    let processingResult
    if (fileSizeMBNum > STREAMING_THRESHOLD_MB) {
      // Use streaming for large files
      logWithBroadcast(`📦 Processing file: ${fileName} Size: ${fileSizeMB} MB using STREAMING mode (yauzl)`, "info")
      logWithBroadcast("🚀 Starting ZIP stream processing...", "info")
      try {
        // Panggil fungsi baru yang berbasis Stream/Yauzl
        processingResult = await processZipStream(filePath, uploadBatch, logWithBroadcast)
        logWithBroadcast("✅ ZIP processing completed successfully", "success")
      } catch (processError) {
        const errorMsg = processError instanceof Error ? processError.message : String(processError)
        logWithBroadcast(`❌ ZIP stream processing failed: ${errorMsg}`, "error")
        if (processError instanceof Error && processError.stack) {
          logWithBroadcast(`📋 Error stack: ${processError.stack}`, "error")
        }
        throw new Error(`ZIP processing failed: ${errorMsg}`)
      }
    } else {
      // Use JSZip for smaller files (backward compatibility)
      logWithBroadcast(`📦 Processing file: ${fileName} Size: ${fileSizeMB} MB using JSZip mode`, "info")
      
      // Read file from disk to ArrayBuffer (only for small files)
      logWithBroadcast("📖 Reading file from disk into memory...", "info")
      const { readFile } = await import("fs/promises")
      let fileBuffer: Buffer
      try {
        fileBuffer = await readFile(filePath)
        logWithBroadcast(`✅ File read successfully: ${(fileBuffer.length / (1024 * 1024)).toFixed(2)} MB in memory`, "success")
      } catch (readError) {
        const errorMsg = readError instanceof Error ? readError.message : String(readError)
        logWithBroadcast(`❌ Failed to read file from disk: ${errorMsg}`, "error")
        throw new Error(`Failed to read file: ${errorMsg}`)
      }

      let bytes: ArrayBuffer
      try {
        const slicedBuffer = fileBuffer.buffer.slice(
          fileBuffer.byteOffset,
          fileBuffer.byteOffset + fileBuffer.byteLength
        )
        // Ensure we have an ArrayBuffer, not SharedArrayBuffer
        bytes = slicedBuffer instanceof ArrayBuffer ? slicedBuffer : new ArrayBuffer(slicedBuffer.byteLength)
        if (!(bytes instanceof ArrayBuffer)) {
          // If still not ArrayBuffer, create a new one and copy data
          const newBuffer = new ArrayBuffer(slicedBuffer.byteLength)
          new Uint8Array(newBuffer).set(new Uint8Array(slicedBuffer))
          bytes = newBuffer
        }
        logWithBroadcast(`✅ ArrayBuffer created: ${(bytes.byteLength / (1024 * 1024)).toFixed(2)} MB`, "success")
      } catch (bufferError) {
        const errorMsg = bufferError instanceof Error ? bufferError.message : String(bufferError)
        logWithBroadcast(`❌ Failed to create ArrayBuffer: ${errorMsg}`, "error")
        throw new Error(`Failed to create ArrayBuffer: ${errorMsg}`)
      }

      // Process the zip file with enhanced binary file storage
      logWithBroadcast("🚀 Starting ZIP processing with JSZip...", "info")
      try {
        processingResult = await processZipWithBinaryStorage(bytes, uploadBatch, logWithBroadcast)
        logWithBroadcast("✅ ZIP processing completed successfully", "success")
      } catch (processError) {
        const errorMsg = processError instanceof Error ? processError.message : String(processError)
        logWithBroadcast(`❌ ZIP processing failed: ${errorMsg}`, "error")
        if (processError instanceof Error && processError.stack) {
          logWithBroadcast(`📋 Error stack: ${processError.stack}`, "error")
        }
        throw new Error(`ZIP processing failed: ${errorMsg}`)
      }
    }

    // CLEANUP: Delete the uploaded ZIP file after successful processing (if requested)
    if (deleteAfterProcessing) {
      try {
        await unlink(filePath)
        logWithBroadcast(`🗑️ Cleaned up uploaded ZIP file: ${filePath}`, "info")
      } catch (cleanupError) {
        logWithBroadcast(`⚠️ Failed to cleanup ZIP file: ${cleanupError}`, "warning")
      }
    }

    return {
      success: true,
      details: processingResult,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : undefined
    
    logWithBroadcast(`💥 Upload processing error: ${errorMessage}`, "error")
    if (errorStack) {
      logWithBroadcast(`📋 Error details: ${errorStack}`, "error")
    }

    // Check for common error types
    if (errorMessage.includes("memory") || errorMessage.includes("allocation") || errorMessage.includes("heap")) {
      logWithBroadcast(
        "💡 TIP: File terlalu besar untuk diproses dengan metode saat ini. Coba file yang lebih kecil atau hubungi administrator.",
        "warning"
      )
    }

    // CLEANUP: Delete the uploaded ZIP file on error too (if requested)
    if (deleteAfterProcessing) {
      try {
        await unlink(filePath)
        logWithBroadcast(`🗑️ Cleaned up ZIP file after error: ${filePath}`, "info")
      } catch (cleanupError) {
        logWithBroadcast(`⚠️ Failed to cleanup ZIP file after error: ${cleanupError}`, "warning")
      }
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}

