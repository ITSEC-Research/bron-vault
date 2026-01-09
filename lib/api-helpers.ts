import { NextRequest, NextResponse } from "next/server"

/**
 * Check if request has been aborted by client
 * Returns true if request should be cancelled
 */
export function isRequestAborted(request: NextRequest): boolean {
  return request.signal?.aborted === true
}

/**
 * Throw error if request is aborted
 * Use this before expensive operations (database queries)
 */
export function throwIfAborted(request: NextRequest): void {
  if (isRequestAborted(request)) {
    const error = new Error("Request aborted by client")
    error.name = "AbortError"
    throw error
  }
}

/**
 * Get AbortSignal from request (for passing to database driver)
 * Returns undefined if signal not available or already aborted
 */
export function getRequestSignal(request: NextRequest): AbortSignal | undefined {
  const signal = request.signal as AbortSignal | undefined
  // Only return signal if it exists and not already aborted
  return signal && !signal.aborted ? signal : undefined
}

/**
 * Wrap async operation with abort check
 * Automatically checks before and after operation
 */
export async function withAbortCheck<T>(
  request: NextRequest,
  operation: () => Promise<T>
): Promise<T> {
  throwIfAborted(request)
  const result = await operation()
  throwIfAborted(request)
  return result
}

/**
 * Handle abort and connection errors gracefully
 * IMPORTANT: Abort request adalah perilaku user yang valid, bukan error sistem
 * JANGAN log sebagai error - return response dengan silent
 * 
 * Returns appropriate NextResponse for aborted/closed requests
 * Returns null if error is not an abort error (let caller handle it)
 */
export function handleAbortError(error: unknown): NextResponse | null {
  // Handle AbortError (from throwIfAborted)
  if (error instanceof Error && error.name === 'AbortError') {
    // Silent - tidak ada console.log sama sekali
    // Abort request adalah normal behavior, bukan error
    return NextResponse.json(
      { error: "Cancelled" },
      { status: 499 } // 499 = Client Closed Request
    )
  }

  // Handle ECONNRESET (connection reset by client)
  if (error instanceof Error && (error as any).code === 'ECONNRESET') {
    // Silent - No console.log statements are present
    // Connection reset is a normal behavior when the client aborts
    return NextResponse.json(
      { error: "Cancelled" },
      { status: 499 }
    )
  }

  // Not an abort error, return null to let caller handle it
  return null
}

