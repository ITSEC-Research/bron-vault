import { type NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { createReadStream, existsSync } from "fs"
import path from "path"
import { validateRequest } from "@/lib/auth"

export async function POST(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { deviceId, filePath } = await request.json()

    if (!deviceId || !filePath) {
      return NextResponse.json({ error: "Device ID and file path are required" }, { status: 400 })
    }

    // Try to get text content first
    let results = await executeQuery(
      "SELECT content FROM files WHERE device_id = ? AND file_path = ? AND content IS NOT NULL",
      [deviceId, filePath],
    )

    if (results && (results as any[]).length > 0) {
      const content = (results as any[])[0].content
      return NextResponse.json({ content })
    }

    // If not found, try to get local_file_path for binary/image
    results = await executeQuery(
      "SELECT local_file_path FROM files WHERE device_id = ? AND file_path = ? AND local_file_path IS NOT NULL",
      [deviceId, filePath],
    )

    if (!results || (results as any[]).length === 0) {
      return NextResponse.json({ error: "File not found or not readable" }, { status: 404 })
    }

    const localFilePath = (results as any[])[0].local_file_path
    const absPath = path.isAbsolute(localFilePath)
      ? localFilePath
      : path.join(process.cwd(), localFilePath)

    if (!existsSync(absPath)) {
      return NextResponse.json({ error: "File not found on disk" }, { status: 404 })
    }

    // Guess content type from extension
    const ext = path.extname(absPath).toLowerCase()
    let contentType = "application/octet-stream"
    if ([".jpg", ".jpeg"].includes(ext)) contentType = "image/jpeg"
    else if (ext === ".png") contentType = "image/png"
    else if (ext === ".gif") contentType = "image/gif"
    else if (ext === ".bmp") contentType = "image/bmp"
    else if (ext === ".webp") contentType = "image/webp"

    // Read file and return as stream
    const fileBuffer = await new Promise<Buffer>((resolve, reject) => {
      const chunks: Buffer[] = []
      const stream = createReadStream(absPath)
      stream.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
      stream.on("end", () => resolve(Buffer.concat(chunks)))
      stream.on("error", (err) => reject(err))
    })

    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `inline; filename=\"${path.basename(absPath)}\"`,
      },
    })
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
