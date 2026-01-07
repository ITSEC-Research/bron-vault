// Shared connections store for upload log streaming
// This ensures both upload API and upload-logs API use the same connections Map

declare global {
  // eslint-disable-next-line no-var
  var uploadLogConnections: Map<string, ReadableStreamDefaultController> | undefined
}

// Create or get existing connections Map
export const connections = globalThis.uploadLogConnections ?? new Map<string, ReadableStreamDefaultController>()

// Store in global to persist across hot reloads
globalThis.uploadLogConnections = connections

export function broadcastLogToSession(
  sessionId: string,
  message: string,
  type: "info" | "success" | "warning" | "error" = "info",
) {
  console.log(`🔍 broadcastLogToSession called: sessionId=${sessionId}, message=${message}`)
  const controller = connections.get(sessionId)
  console.log(`📡 Controller found for session ${sessionId}:`, !!controller)
  console.log(`📊 Total active connections:`, connections.size)

  if (controller) {
    const logData = {
      timestamp: new Date().toISOString(),
      message,
      type,
    }

    const data = `data: ${JSON.stringify(logData)}\n\n`

    try {
      controller.enqueue(new TextEncoder().encode(data))
      console.log(`✅ Log sent successfully to session ${sessionId}`)
    } catch (error) {
      console.error("Failed to send log to client:", error)
      connections.delete(sessionId)
    }
  } else {
    console.log(`❌ No controller found for session ${sessionId}`)
    console.log(`📋 Available sessions:`, Array.from(connections.keys()))
  }
}

export function closeLogSession(sessionId: string) {
  console.log(`🔒 Closing log session: ${sessionId}`)
  const controller = connections.get(sessionId)

  if (controller) {
    try {
      // Send final message before closing
      const finalData = {
        timestamp: new Date().toISOString(),
        message: "🔒 Log session closed",
        type: "info" as const,
      }

      const data = `data: ${JSON.stringify(finalData)}\n\n`
      controller.enqueue(new TextEncoder().encode(data))

      // Close the stream
      controller.close()
      console.log(`✅ Log session ${sessionId} closed successfully`)
    } catch (error) {
      console.error(`Failed to close log session ${sessionId}:`, error)
    } finally {
      // Remove from connections map
      connections.delete(sessionId)
      console.log(`📊 Session ${sessionId} removed. Active connections: ${connections.size}`)
    }
  } else {
    console.log(`⚠️ No active session found for ${sessionId}`)
  }
}
