type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: any
  context?: string
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development'
  private isServer = typeof window === 'undefined'

  private formatMessage(level: LogLevel, message: string, data?: any, context?: string): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
      context
    }
  }

  private shouldLog(level: LogLevel): boolean {
    // In production, only log warnings and errors
    if (!this.isDevelopment) {
      return level === 'warn' || level === 'error'
    }
    return true
  }

  private logToConsole(entry: LogEntry) {
    if (!this.shouldLog(entry.level)) return

    const prefix = entry.context ? `[${entry.context}]` : ''
    const message = `${prefix} ${entry.message}`

    switch (entry.level) {
      case 'debug':
        console.debug(message, entry.data)
        break
      case 'info':
        console.info(message, entry.data)
        break
      case 'warn':
        console.warn(message, entry.data)
        break
      case 'error':
        console.error(message, entry.data)
        break
    }
  }

  debug(message: string, data?: any, context?: string) {
    const entry = this.formatMessage('debug', message, data, context)
    this.logToConsole(entry)
  }

  info(message: string, data?: any, context?: string) {
    const entry = this.formatMessage('info', message, data, context)
    this.logToConsole(entry)
  }

  warn(message: string, data?: any, context?: string) {
    const entry = this.formatMessage('warn', message, data, context)
    this.logToConsole(entry)
  }

  error(message: string, data?: any, context?: string) {
    const entry = this.formatMessage('error', message, data, context)
    this.logToConsole(entry)
  }

  // API-specific logging with broadcast capability
  apiLog(message: string, level: LogLevel = 'info', sessionId?: string) {
    this.logToConsole(this.formatMessage(level, message, undefined, 'API'))
    
    // If sessionId provided, broadcast to client (for upload logs)
    if (sessionId && this.isServer) {
      try {
        // Dynamic import to avoid circular dependencies
        import('./upload-connections').then(({ broadcastLogToSession }) => {
          const logType = level === 'debug' ? 'info' : level === 'warn' ? 'warning' : level
          broadcastLogToSession(sessionId, message, logType as "info" | "success" | "warning" | "error")
        }).catch(() => {
          // Silently fail if broadcast is not available
        })
      } catch {
        // Silently fail if broadcast is not available
      }
    }
  }
}

// Export singleton instance
export const logger = new Logger()

// Convenience exports for common use cases
export const logDebug = (message: string, data?: any, context?: string) => 
  logger.debug(message, data, context)

export const logInfo = (message: string, data?: any, context?: string) => 
  logger.info(message, data, context)

export const logWarn = (message: string, data?: any, context?: string) => 
  logger.warn(message, data, context)

export const logError = (message: string, data?: any, context?: string) => 
  logger.error(message, data, context)

export const logApi = (message: string, level: LogLevel = 'info', sessionId?: string) => 
  logger.apiLog(message, level, sessionId)
