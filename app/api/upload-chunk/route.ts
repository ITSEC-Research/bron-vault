import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { chunkManager } from "@/lib/upload/chunk-manager"
import { existsSync } from "fs"
import { mkdir } from "fs/promises"
import path from "path"

/**
 * POST /api/upload-chunk
 * Upload a single chunk of a file
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
    const formData = await request.formData()

    const chunk = formData.get("chunk") as File
    const chunkIndex = parseInt(formData.get("chunkIndex") as string)
    const totalChunks = parseInt(formData.get("totalChunks") as string)
    const fileId = formData.get("fileId") as string
    const fileName = formData.get("fileName") as string
    const fileSize = parseInt(formData.get("fileSize") as string)
    const _chunkSize = parseInt(formData.get("chunkSize") as string)
    const sessionId = (formData.get("sessionId") as string) || "default"

    console.log(`📥 [CHUNK UPLOAD] Receiving chunk ${chunkIndex + 1}/${totalChunks} for file: ${fileName} (${fileId})`)
    console.log(`   Chunk size: ${chunk.size} bytes, Total file size: ${fileSize} bytes`)

    // Validate required fields
    if (!chunk || isNaN(chunkIndex) || isNaN(totalChunks) || !fileId || !fileName || isNaN(fileSize)) {
      return NextResponse.json(
        { success: false, error: "Missing required fields" },
        { status: 400 }
      )
    }

    // SECURITY: Validate fileId format to prevent path traversal
    if (!/^[a-zA-Z0-9_\-]+$/.test(fileId)) {
      return NextResponse.json(
        { success: false, error: "Invalid fileId format" },
        { status: 400 }
      )
    }

    // SECURITY: Validate chunk index bounds
    if (chunkIndex < 0 || chunkIndex >= totalChunks || totalChunks <= 0) {
      return NextResponse.json(
        { success: false, error: "Invalid chunk index or total chunks" },
        { status: 400 }
      )
    }

    // Initialize chunk metadata if first chunk
    let metadata = chunkManager.getChunkMetadata(fileId)
    if (!metadata) {
      metadata = chunkManager.initializeChunk(fileId, fileName, fileSize, totalChunks, sessionId)
    }

    // Get chunk file path
    const chunkPath = chunkManager.getChunkPath(fileId, chunkIndex)
    const chunkDir = path.dirname(chunkPath)

    // Create chunk directory if it doesn't exist
    if (!existsSync(chunkDir)) {
      await mkdir(chunkDir, { recursive: true })
    }

    // Convert File to Buffer and write to disk
    // Note: For very large chunks, we could stream, but File API in Next.js
    // requires conversion to Buffer first for reliable handling
    const arrayBuffer = await chunk.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Write buffer to disk
    const { writeFile } = await import("fs/promises")
    await writeFile(chunkPath, buffer)

    // Mark chunk as uploaded
    chunkManager.markChunkUploaded(fileId, chunkIndex)

    console.log(`✅ [CHUNK UPLOAD] Chunk ${chunkIndex + 1}/${totalChunks} saved successfully to: ${chunkPath}`)

    return NextResponse.json({
      success: true,
      chunkIndex,
      fileId,
      message: `Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`,
    })
  } catch (error) {
    console.error("❌ [CHUNK UPLOAD] Error uploading chunk:", error)
    console.error("   Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined,
    })
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to upload chunk",
      },
      { status: 500 }
    )
  }
}

