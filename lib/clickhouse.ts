import { createClient, type ClickHouseClient } from '@clickhouse/client'

// ClickHouse connection configuration
// ALL credentials MUST come from .env.local or .env - NO HARDCODED VALUES!
// If not found in .env.local or .env, will throw error (no fallback)

/**
 * Validate required environment variables
 * THROWS ERROR if not found (no fallback)
 */
function validateEnvVars() {
  const requiredEnvVars = {
    CLICKHOUSE_HOST: process.env.CLICKHOUSE_HOST,
    CLICKHOUSE_USER: process.env.CLICKHOUSE_USER,
    CLICKHOUSE_PASSWORD: process.env.CLICKHOUSE_PASSWORD,
    CLICKHOUSE_DATABASE: process.env.CLICKHOUSE_DATABASE,
  }

  // Check if all required variables are set
  const missingVars = Object.entries(requiredEnvVars)
    .filter(([_key, value]) => !value)
    .map(([key]) => key)

  if (missingVars.length > 0) {
    throw new Error(
      `❌ Missing required ClickHouse environment variables: ${missingVars.join(', ')}\n` +
      `   Please add them to .env.local or .env file:\n` +
      `   CLICKHOUSE_HOST=...\n` +
      `   CLICKHOUSE_USER=...\n` +
      `   CLICKHOUSE_PASSWORD=...\n` +
      `   CLICKHOUSE_DATABASE=...`
    )
  }

  return {
    host: requiredEnvVars.CLICKHOUSE_HOST!,
    username: requiredEnvVars.CLICKHOUSE_USER!,
    password: requiredEnvVars.CLICKHOUSE_PASSWORD!,
    database: requiredEnvVars.CLICKHOUSE_DATABASE!,
  }
}

/**
 * Singleton Pattern to prevent multiple instances during hot-reload in development
 * 
 * In Next.js development environment, Hot Reload often creates new instances
 * every time a file is saved, without closing old connections. This can cause
 * "Too many connections" error in ClickHouse.
 * 
 * With Singleton pattern, we reuse existing connections.
 */
const globalForClickHouse = global as unknown as {
  clickhouse: ClickHouseClient | undefined
}

/**
 * Get or create ClickHouse client instance (Singleton)
 * Lazy initialization - only creates client when needed (not at module load)
 */
function getClickHouseClient(): ClickHouseClient {
  // If already exists in global (development hot-reload), reuse
  if (globalForClickHouse.clickhouse) {
    return globalForClickHouse.clickhouse
  }

  // Validate environment variables first (THROWS ERROR if not found)
  const chConfig = validateEnvVars()

  // Build ClickHouse URL (new format - replaces deprecated 'host' option)
  // Format: http://username:password@host:port/database
  // CLICKHOUSE_HOST should already include protocol and port (e.g., http://clickhouse:8123)
  let clickhouseUrl: string
  if (chConfig.host.includes('://')) {
    // Extract host:port from URL (e.g., http://clickhouse:8123 -> clickhouse:8123)
    const urlMatch = chConfig.host.match(/^https?:\/\/(.+)$/)
    const hostPort = urlMatch ? urlMatch[1] : chConfig.host
    clickhouseUrl = `http://${encodeURIComponent(chConfig.username)}:${encodeURIComponent(chConfig.password)}@${hostPort}/${chConfig.database}`
  } else {
    // If host doesn't include protocol, assume http://
    clickhouseUrl = `http://${encodeURIComponent(chConfig.username)}:${encodeURIComponent(chConfig.password)}@${chConfig.host}/${chConfig.database}`
  }

  // Create new client using URL (new recommended way)
  const client = createClient({
    url: clickhouseUrl,
    clickhouse_settings: {
      // Optional: Timeout settings to prevent hanging
      receive_timeout: 30000,
    },
  })

  // Store in global for development (hot-reload protection)
  // In production, Next.js doesn't hot-reload, so not needed
  if (process.env.NODE_ENV !== 'production') {
    globalForClickHouse.clickhouse = client
  }

  return client
}

// Lazy getter for client - only creates connection when actually needed
// This prevents build-time errors when environment variables aren't available
export function getClient(): ClickHouseClient {
  return getClickHouseClient()
}

// Export client getter (for backward compatibility)
// Use getClient() instead of direct client access
export const client = new Proxy({} as ClickHouseClient, {
  get(_target, prop) {
    return getClickHouseClient()[prop as keyof ClickHouseClient]
  }
})

/**
 * Execute query with format similar to MySQL executeQuery
 * Supports named parameters (ClickHouse format)
 * 
 * ClickHouse uses named parameters with type annotation:
 * - {paramName:Type} in query
 * - { paramName: value } in params object
 * 
 * @param query SQL query with named parameters: {paramName:Type}
 * @param params Object with parameter values: { paramName: value }
 * @returns Array of results (similar to MySQL format)
 * 
 * @example
 * ```typescript
 * const result = await executeQuery(
 *   "SELECT * FROM credentials WHERE device_id = {deviceId:String} AND domain = {domain:String}",
 *   { deviceId: "123", domain: "example.com" }
 * )
 * ```
 */
export async function executeQuery(
  query: string, 
  params: Record<string, unknown> = {}
): Promise<any[]> {
  try {
    const chClient = getClickHouseClient()
    const resultSet = await chClient.query({
      query: query,
      format: 'JSONEachRow', // Important so output is Array of Objects similar to MySQL
      query_params: params,  // ClickHouse uses named parameters
    })
    
    const data = await resultSet.json()
    return data as any[]
  } catch (error) {
    console.error("❌ ClickHouse query error:", error)
    console.error("❌ Error type:", typeof error)
    console.error("❌ Error message:", error instanceof Error ? error.message : String(error))
    console.error("❌ Error code:", (error as any)?.code)
    console.error("❌ Error type (ClickHouse):", (error as any)?.type)
    // Log short query snippet for debugging (don't log full if too long)
    console.error("📝 Query Snippet:", query.substring(0, 200) + (query.length > 200 ? "..." : ""))
    console.error("📦 Params:", params)
    
    // Re-throw error for handling in caller
    throw error
  }
}

/**
 * Test ClickHouse connection
 * Useful for health check or initialization verification
 */
export async function testConnection(): Promise<boolean> {
  try {
    const result = await executeQuery("SELECT 1 as test")
    return result.length > 0 && result[0].test === 1
  } catch (error) {
    console.error("❌ ClickHouse connection test failed:", error)
    return false
  }
}

/**
 * Close ClickHouse connection (for cleanup)
 * Usually not needed as client handles connection pooling
 */
export async function closeConnection() {
  try {
    const chClient = getClickHouseClient()
    await chClient.close()
    // Clear global reference
    if (globalForClickHouse.clickhouse) {
      globalForClickHouse.clickhouse = undefined
    }
    console.log("✅ ClickHouse connection closed")
  } catch (error) {
    console.error("❌ Error closing ClickHouse connection:", error)
  }
}


