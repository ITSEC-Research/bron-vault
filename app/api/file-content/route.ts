import { type NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { existsSync, createReadStream } from "fs"
import { readFile } from "fs/promises"
import path from "path"
import { validateRequest } from "@/lib/auth"
import { Readable } from "stream"
import { getStorageProvider } from "@/lib/storage"

export const runtime = "nodejs"

// Static base directory for uploads - resolved once at module load
const UPLOADS_BASE_DIR = path.resolve(process.cwd(), 'uploads')

/**
 * Safely resolve a file path within the uploads directory
 * Returns null if path is invalid or escapes the uploads directory
 */
function safeResolvePath(localFilePath: string): string | null {
  if (!localFilePath || typeof localFilePath !== 'string') {
    return null
  }

  // Sanitize: remove null bytes and normalize
  const sanitized = localFilePath.replace(/\0/g, '').trim()
  if (!sanitized) {
    return null
  }

  // Build absolute path
  let absolutePath: string
  if (path.isAbsolute(sanitized)) {
    // Already absolute - normalize it
    absolutePath = path.normalize(sanitized)
  } else {
    // Relative path - join with cwd (uploads paths stored relative to project root)
    absolutePath = path.join(process.cwd(), sanitized)
  }

  // Resolve to get canonical path (resolves .. and symlinks)
  const resolvedPath = path.resolve(absolutePath)

  // Security check: ensure path is within uploads directory
  // Allow paths that START with uploads dir or ARE within it
  if (!resolvedPath.startsWith(UPLOADS_BASE_DIR)) {
    console.error(`Path traversal attempt: ${resolvedPath} is outside ${UPLOADS_BASE_DIR}`)
    return null
  }

  return resolvedPath
}

/**
 * Check if file exists at the given safe path
 */
function fileExistsAtPath(safePath: string): boolean {
  try {
    return existsSync(safePath)
  } catch {
    return false
  }
}

/**
 * Read text file content from safe path
 */
async function readTextFile(safePath: string): Promise<string> {
  return await readFile(safePath, "utf-8")
}

/**
 * Create readable stream from safe path
 */
function createFileStream(safePath: string): Readable {
  return createReadStream(safePath)
}

function nodeStreamToWeb(stream: Readable): ReadableStream {
  // Node 17+ includes toWeb
  return (stream as any).toWeb?.() ?? new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk))
      stream.on("end", () => controller.close())
      stream.on("error", (err) => controller.error(err))
    },
    cancel() {
      stream.destroy()
    }
  })
}

// Helper: Determine if file is text based on extension
function isTextFileByExtension(fileName: string): boolean {
  const textExtensions = [
    ".txt",
    ".log",
    ".json",
    ".xml",
    ".html",
    ".htm",
    ".css",
    ".js",
    ".csv",
    ".ini",
    ".cfg",
    ".conf",
    ".md",
    ".sql",
    ".readme",
  ]
  const ext = path.extname(fileName).toLowerCase()
  return (
    textExtensions.includes(ext) ||
    fileName.toLowerCase().includes("password") ||
    !fileName.includes(".")
  )
}

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { deviceId, filePath } = await request.json()

    if (!deviceId || !filePath) {
      return NextResponse.json({ error: "Device ID and file path are required" }, { status: 400 })
    }

    // Get file record with local_file_path
    const results = (await executeQuery(
      `SELECT local_file_path, file_name, file_type 
       FROM files 
       WHERE device_id = ? AND file_path = ? 
       AND local_file_path IS NOT NULL`,
      [deviceId, filePath],
    )) as any[]

    if (!results || results.length === 0) {
      return NextResponse.json({ error: "File not found or not migrated" }, { status: 404 })
    }

    const fileRecord = results[0]
    const fileName = fileRecord.file_name || path.basename(filePath)

    // Read from disk via local_file_path
    if (!fileRecord.local_file_path) {
      return NextResponse.json({ error: "File path not found" }, { status: 404 })
    }

    // Get storage provider
    const storageProvider = await getStorageProvider()
    const storageType = storageProvider.getType()

    if (storageType === "local") {
      // LOCAL STORAGE: Use existing filesystem-based logic with security checks
      const safePath = safeResolvePath(fileRecord.local_file_path)
      
      if (!safePath) {
        console.error(`Invalid or unsafe file path: ${fileRecord.local_file_path}`)
        return NextResponse.json({ error: "Access denied: Invalid file path" }, { status: 403 })
      }

      if (!fileExistsAtPath(safePath)) {
        return NextResponse.json({ error: "File not found on disk" }, { status: 404 })
      }

      // Determine file type
      const fileType = fileRecord.file_type || "unknown"
      const isText =
        fileType === "text" || (fileType === "unknown" && isTextFileByExtension(fileName))

      if (isText) {
        try {
          const content = await readTextFile(safePath)
          return NextResponse.json({ content })
        } catch (error) {
          console.error("Error reading text file:", error)
          return NextResponse.json(
            { error: "Failed to read file", details: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 },
          )
        }
      }

      // Binary file — stream from local fs
      const ext = path.extname(safePath).toLowerCase()
      const contentType = getContentType(ext)

      try {
        const nodeStream = createFileStream(safePath)
        const webStream = nodeStreamToWeb(nodeStream)

        return new NextResponse(webStream, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="${path.basename(safePath)}"`,
          },
        })
      } catch (error) {
        console.error("Error streaming file:", error)
        return NextResponse.json(
          { error: "Failed to stream file", details: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 },
        )
      }
    } else {
      // S3 STORAGE: Read from object storage
      const storageKey = fileRecord.local_file_path

      const fileType = fileRecord.file_type || "unknown"
      const isText =
        fileType === "text" || (fileType === "unknown" && isTextFileByExtension(fileName))

      try {
        const fileExists = await storageProvider.exists(storageKey)
        if (!fileExists) {
          return NextResponse.json({ error: "File not found in object storage" }, { status: 404 })
        }

        if (isText) {
          const data = await storageProvider.get(storageKey)
          const content = data.toString("utf-8")
          return NextResponse.json({ content })
        }

        // Binary file — stream from S3
        const ext = path.extname(fileName).toLowerCase()
        const contentType = getContentType(ext)

        const stream = await storageProvider.getStream(storageKey)
        const webStream = nodeStreamToWeb(stream as Readable)

        return new NextResponse(webStream, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `inline; filename="${fileName}"`,
          },
        })
      } catch (error) {
        console.error("Error reading from object storage:", error)
        return NextResponse.json(
          { error: "Failed to read file from storage", details: error instanceof Error ? error.message : "Unknown error" },
          { status: 500 },
        )
      }
    }
  } catch (error) {
    console.error("File content error:", error)
    return NextResponse.json(
      {
        error: "Failed to get file content",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Helper: Get content type from file extension
function getContentType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".zip": "application/zip",
  }
  return mimeTypes[ext] || "application/octet-stream"
}
