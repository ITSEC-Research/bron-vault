import { type NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { existsSync, createReadStream } from "fs"
import { readFile } from "fs/promises"
import path from "path"
import { validateRequest } from "@/lib/auth"
import { Readable } from "stream"

export const runtime = "nodejs"

function nodeStreamToWeb(stream: Readable): ReadableStream {
  // Node 17+ includes toWeb
  // @ts-ignore
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

    const localFilePath = fileRecord.local_file_path
    const absPath = path.isAbsolute(localFilePath)
      ? localFilePath
      : path.join(process.cwd(), localFilePath)

    if (!existsSync(absPath)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 })
    }

    // STEP 4: Determine file type
    // Priority: file_type column > extension check
    const fileType = fileRecord.file_type || "unknown"
    const isText =
      fileType === "text" || (fileType === "unknown" && isTextFileByExtension(fileName))

    // STEP 5: Handle text files - read as text and return JSON
    if (isText) {
      try {
        const content = await readFile(absPath, "utf-8")
        return NextResponse.json({ content })
      } catch (error) {
        console.error("Error reading text file:", error)
        return NextResponse.json(
          {
            error: "Failed to read file",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 },
        )
      }
    }

    // STEP 6: Handle binary files (images, etc.) - return stream
    const ext = path.extname(absPath).toLowerCase()
    let contentType = "application/octet-stream"

    // Image types
    if ([".jpg", ".jpeg"].includes(ext)) contentType = "image/jpeg"
    else if (ext === ".png") contentType = "image/png"
    else if (ext === ".gif") contentType = "image/gif"
    else if (ext === ".bmp") contentType = "image/bmp"
    else if (ext === ".webp") contentType = "image/webp"
    // Add more MIME types as needed

    try {
      const nodeStream = createReadStream(absPath)
      const webStream = nodeStreamToWeb(nodeStream)

      return new NextResponse(webStream, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `inline; filename="${path.basename(absPath)}"`,
        },
      })
    } catch (error) {
      console.error("Error streaming file:", error)
      return NextResponse.json(
        {
          error: "Failed to stream file",
          details: error instanceof Error ? error.message : "Unknown error",
        },
        { status: 500 },
      )
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
