// instrumentation.ts
// Next.js 14+ way to setup global error handlers
// This file must be in the root directory (next to next.config.mjs and package.json)
// 
// NOTE: We also setup handlers in lib/error-handler.ts which auto-runs on import
// This provides double protection and ensures handlers are setup early

import { setupGlobalErrorHandlers } from "@/lib/error-handler"

/**
 * Setup global error handlers to handle uncaughtException and unhandledRejection
 * Only suppress ECONNRESET/aborted errors (normal behavior when client aborts)
 * Real errors are still thrown for debugging
 */
export async function register() {
  // Setup handlers (will check for duplicates internally)
  setupGlobalErrorHandlers()
}

