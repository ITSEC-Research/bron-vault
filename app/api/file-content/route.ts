import { type NextRequest, NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"
import { existsSync, createReadStream } from "fs"
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

    let results = await executeQuery(
      "SELECT content FROM files WHERE device_id = ? AND file_path = ? AND content IS NOT NULL",
      [deviceId, filePath],
    )

    if (results && (results as any[]).length > 0) {
      const content = (results as any[])[0].content
      return NextResponse.json({ content })
    }

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

    const ext = path.extname(absPath).toLowerCase()
    let contentType = "application/octet-stream"
    if ([".jpg", ".jpeg"].includes(ext)) contentType = "image/jpeg"
    else if (ext === ".png") contentType = "image/png"
    else if (ext === ".gif") contentType = "image/gif"
    else if (ext === ".bmp") contentType = "image/bmp"
    else if (ext === ".webp") contentType = "image/webp"

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
