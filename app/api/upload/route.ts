import { type NextRequest } from "next/server"
import { handleUploadRequest } from "@/lib/upload/upload-handler"

export async function POST(request: NextRequest) {
  return handleUploadRequest(request)
}

