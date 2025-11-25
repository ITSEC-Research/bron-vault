import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { chunkManager } from "@/lib/upload/chunk-manager"

/**
 * GET /api/upload-chunk-status
 * Get upload progress for a file
 */
export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const fileId = searchParams.get("fileId")

    if (!fileId) {
      return NextResponse.json(
        { success: false, error: "fileId parameter is required" },
        { status: 400 }
      )
    }

    const metadata = chunkManager.getChunkMetadata(fileId)
    if (!metadata) {
      return NextResponse.json(
        { success: false, error: "File upload not found" },
        { status: 404 }
      )
    }

    const uploadedChunks = await chunkManager.getUploadedChunkIndices(fileId)
    const progress = (uploadedChunks.length / metadata.totalChunks) * 100

    return NextResponse.json({
      success: true,
      fileId,
      totalChunks: metadata.totalChunks,
      uploadedChunks: uploadedChunks.length,
      uploadedChunkIndices: uploadedChunks,
      progress: Math.round(progress),
      canResume: uploadedChunks.length > 0 && uploadedChunks.length < metadata.totalChunks,
    })
  } catch (error) {
    console.error("Error getting chunk status:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to get chunk status",
      },
      { status: 500 }
    )
  }
}

