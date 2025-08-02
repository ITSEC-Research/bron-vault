import type { NextRequest } from "next/server"
import { connections } from "@/lib/upload-connections"
import { validateRequest } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get("sessionId") || "default"

  const stream = new ReadableStream({
    start(controller) {
      // Store this connection
      connections.set(sessionId, controller)
      console.log(`🔗 Connection stored for session: ${sessionId}`)
      console.log(`📊 Total connections now: ${connections.size}`)
      console.log(`📋 All sessions: ${Array.from(connections.keys())}`)

      // Send initial connection message
      const data = `data: ${JSON.stringify({
        timestamp: new Date().toISOString(),
        message: "🔗 Connected to upload log stream",
        type: "info",
      })}\n\n`

      controller.enqueue(new TextEncoder().encode(data))

      // Send heartbeat to ensure connection is established
      setTimeout(() => {
        if (connections.has(sessionId)) {
          const heartbeat = `data: ${JSON.stringify({
            timestamp: new Date().toISOString(),
            message: "✅ Connection established, ready for upload logs",
            type: "info",
          })}\n\n`

          try {
            controller.enqueue(new TextEncoder().encode(heartbeat))
          } catch (error) {
            console.error('Failed to send heartbeat:', error)
            connections.delete(sessionId)
          }
        }
      }, 100) // Send heartbeat after 100ms
    },
    cancel() {
      // Clean up connection
      connections.delete(sessionId)
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    },
  })
}


