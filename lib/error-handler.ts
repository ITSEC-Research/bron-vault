// lib/error-handler.ts
// Setup global error handlers to handle ECONNRESET/aborted errors
// This file is imported early in the application to setup handlers before Next.js loads

/**
 * Setup global error handlers to handle uncaughtException and unhandledRejection
 * Only suppress ECONNRESET/aborted errors (normal behavior when client aborts)
 * Real errors are still thrown for debugging
 * 
 * IMPORTANT: Call this function as early as possible, before Next.js starts
 */
export function setupGlobalErrorHandlers() {
  // Only setup in server-side (not in Edge Runtime)
  if (typeof process !== 'undefined' && typeof process.on === 'function') {
    // Check if handlers already setup (prevent duplicate)
    if ((global as any).__errorHandlersSetup) {
      return
    }
    (global as any).__errorHandlersSetup = true

    // Handle uncaughtException - only suppress ECONNRESET/aborted errors
    process.on('uncaughtException', (err: Error & { code?: string }) => {
      // Only suppress ECONNRESET/aborted errors (normal behavior when client aborts)
      const isAbortError = 
        err.code === 'ECONNRESET' || 
        err.message?.toLowerCase().includes('aborted') ||
        err.message?.toLowerCase().includes('abort') ||
        err.name === 'AbortError' ||
        // Check stack trace for abort-related functions
        err.stack?.includes('abortIncoming') ||
        err.stack?.includes('socketOnClose')

      if (isAbortError) {
        // Silent - this is normal when client aborts request
        // Don't log, don't throw - let the error disappear
        return
      }
      
      // Re-throw other uncaught exceptions (real errors)
      // Next.js will handle this with error overlay
      throw err
    })

    // Handle unhandledRejection - also suppress abort errors
    // Sometimes ClickHouse client throws unhandled promises when connection is closed
    process.on('unhandledRejection', (reason: any) => {
      const errorReason = reason instanceof Error ? reason : null
      const isAbortError = 
        (errorReason && (
          (errorReason as any).code === 'ECONNRESET' ||
          errorReason.message?.toLowerCase().includes('aborted') ||
          errorReason.message?.toLowerCase().includes('abort') ||
          errorReason.name === 'AbortError' ||
          errorReason.stack?.includes('abortIncoming') ||
          errorReason.stack?.includes('socketOnClose')
        )) ||
        (reason && typeof reason === 'object' && 'code' in reason && reason.code === 'ECONNRESET')

      if (isAbortError) {
        // Silent - this is normal when client aborts request
        // Don't log, don't throw - let the promise rejection disappear
        return
      }
      
      // Log other unhandled rejections (real errors)
      // Only log in development for debugging
      if (process.env.NODE_ENV === 'development') {
        console.error('Unhandled Rejection:', reason)
      }
    })
  }
}

// Auto-setup when this file is imported
// This will run when the module is loaded
if (typeof process !== 'undefined' && typeof process.on === 'function') {
  setupGlobalErrorHandlers()
}

