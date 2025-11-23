import { writeFile, mkdir, unlink } from "fs/promises"
import { existsSync } from "fs"
import path from "path"
import { initializeDatabase } from "@/lib/mysql"
import { processZipWithBinaryStorage } from "./zip-processor"

export interface FileUploadResult {
  success: boolean
  details?: any
  error?: string
}

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

    // Generate unique upload batch ID
    const uploadBatch = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`

    // Process the zip file with enhanced binary file storage
    const processingResult = await processZipWithBinaryStorage(bytes, uploadBatch, logWithBroadcast)

    // CLEANUP: Delete the uploaded ZIP file after successful processing
    try {
      await unlink(uploadedFilePath)
      logWithBroadcast(`🗑️ Cleaned up uploaded ZIP file: ${uploadedFilePath}`, "info")
    } catch (cleanupError) {
      logWithBroadcast(`⚠️ Failed to cleanup ZIP file: ${cleanupError}`, "warning")
    }

    return {
      success: true,
      details: processingResult,
    }
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

