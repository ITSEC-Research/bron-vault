import mysql, { Pool, PoolConnection, QueryResult, RowDataPacket, FieldPacket, ResultSetHeader, OkPacket, ProcedureCallPacket } from "mysql2/promise"

// MySQL connection configuration - lazy loaded
const getDbConfig = () => ({
  host: process.env.MYSQL_HOST || "localhost",
  port: Number.parseInt(process.env.MYSQL_PORT || "3306"),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "stealer_logs",
  charset: "utf8mb4",
})

// Singleton pattern for connection pool - lazy initialization
// This prevents blocking startup while waiting for DB connection
const globalForMysql = global as unknown as {
  mysqlPool: Pool | undefined
}

function getPool(): Pool {
  if (globalForMysql.mysqlPool) {
    return globalForMysql.mysqlPool
  }

  const dbConfig = getDbConfig()
  
  // Create connection pool with optimized settings for high volume
  globalForMysql.mysqlPool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 50,
    queueLimit: 0,
    // Add connection timeout to prevent hanging
    connectTimeout: 10000,
    // Enable keep-alive
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  })

  return globalForMysql.mysqlPool
}

// Type-safe pool wrapper for lazy initialization
// Matches mysql2/promise Pool interface for backwards compatibility
type QueryReturnType<T extends QueryResult> = Promise<[T, FieldPacket[]]>;

interface LazyPool {
  execute<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[] | ResultSetHeader>(
    sql: string,
    values?: any[]
  ): QueryReturnType<T>;
  query<T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[] | ResultSetHeader | ProcedureCallPacket>(
    sql: string,
    values?: any[]
  ): QueryReturnType<T>;
  getConnection(): Promise<PoolConnection>;
  end(): Promise<void>;
}

// Export pool getter for backwards compatibility with full type support
export const pool: LazyPool = {
  execute: <T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[] | ResultSetHeader>(
    sql: string, 
    values?: any[]
  ) => getPool().execute<T>(sql, values),
  query: <T extends RowDataPacket[][] | RowDataPacket[] | OkPacket | OkPacket[] | ResultSetHeader | ProcedureCallPacket>(
    sql: string, 
    values?: any[]
  ) => getPool().query<T>(sql, values),
  getConnection: () => getPool().getConnection(),
  end: () => getPool().end(),
}

export async function executeQuery(query: string, params: any[] = []) {
  try {
    const [results] = await getPool().execute(query, params)
    return results
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  }
}

export async function initializeDatabase() {
  try {
    const dbConfig = getDbConfig()
    
    // Create database if not exists
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      charset: "utf8mb4",
    })

    await connection.execute(
      `CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    )
    await connection.end()

    // Create tables
    await createTables()

    // IMPORTANT: Ensure local_file_path column exists
    await ensureLocalFilePathColumn()

    // IMPORTANT: Ensure performance indexes exist for optimal query performance
    await ensurePerformanceIndexes()

    console.log("Database initialized successfully")
  } catch (error) {
    console.error("Database initialization error:", error)
    throw error
  }
}

async function ensureLocalFilePathColumn() {
  const dbConfig = getDbConfig()
  try {
    console.log("🔧 Ensuring local_file_path column exists...")

    // Check if column exists
    const columnCheck = await executeQuery(
      `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'files' AND COLUMN_NAME = 'local_file_path'
    `,
      [dbConfig.database],
    )

    if ((columnCheck as any[]).length === 0) {
      console.log("➕ Adding local_file_path column to files table...")
      await executeQuery(`
        ALTER TABLE files ADD COLUMN local_file_path TEXT NULL
      `)

      // Add index
      await executeQuery(`
        CREATE INDEX idx_local_file_path ON files(local_file_path(255))
      `)

      console.log("✅ local_file_path column added successfully")
    } else {
      console.log("✅ local_file_path column already exists")
    }
  } catch (error) {
    console.error("❌ Error ensuring local_file_path column:", error)
    // Don't throw - continue with existing schema
  }
}

async function createTables() {
  // Create devices table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS devices (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) UNIQUE NOT NULL,
      device_name VARCHAR(500) NOT NULL,
      device_name_hash VARCHAR(64) NOT NULL,
      upload_batch VARCHAR(255) NOT NULL,
      upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      total_files INT DEFAULT 0,
      total_credentials INT DEFAULT 0,
      total_domains INT DEFAULT 0,
      total_urls INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_device_name (device_name),
      INDEX idx_device_name_hash (device_name_hash),
      INDEX idx_upload_batch (upload_batch),
      INDEX idx_upload_date (upload_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create files table
  // Updated: Removed FULLTEXT index (not used), added file_type column, added local_file_path support
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS files (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      file_path TEXT NOT NULL,
      file_name VARCHAR(500) NOT NULL,
      parent_path TEXT,
      is_directory BOOLEAN DEFAULT FALSE,
      file_size INT DEFAULT 0,
      content LONGTEXT,
      local_file_path TEXT NULL,
      file_type ENUM('text', 'binary', 'unknown') DEFAULT 'unknown',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_file_name (file_name),
      INDEX idx_created_at (created_at),
      INDEX idx_local_file_path (local_file_path(255))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    COMMENT = 'Files table: metadata only. All file contents stored on disk via local_file_path'
  `)

  // Create credentials table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS credentials (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      url TEXT,
      domain VARCHAR(255),
      tld VARCHAR(50),
      username VARCHAR(500),
      password TEXT,
      browser VARCHAR(255),
      file_path TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_domain (domain),
      INDEX idx_tld (tld),
      INDEX idx_username (username),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create password_stats table for top passwords
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS password_stats (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      password TEXT NOT NULL,
      count INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_count (count)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create analytics cache table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS analytics_cache (
      id INT AUTO_INCREMENT PRIMARY KEY,
      cache_key VARCHAR(255) UNIQUE NOT NULL,
      cache_data LONGTEXT,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cache_key (cache_key),
      INDEX idx_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create software table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS software (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      software_name VARCHAR(500) NOT NULL,
      version VARCHAR(500) NULL,
      source_file VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_software_name (software_name),
      INDEX idx_version (version),
      INDEX idx_source_file (source_file),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Update existing software table if version column is too small
  try {
    await executeQuery(`ALTER TABLE software MODIFY COLUMN version VARCHAR(500) NULL`)
  } catch (_error) {
    // Column might not exist yet or already be the right size, ignore error
    console.log("Version column update skipped (might already be correct size)")
  }

  // Create systeminformation table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS systeminformation (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL UNIQUE,
      stealer_type VARCHAR(100) NOT NULL DEFAULT 'Generic',
      os VARCHAR(500) NULL,
      ip_address VARCHAR(100) NULL,
      username VARCHAR(500) NULL,
      cpu VARCHAR(500) NULL,
      ram VARCHAR(100) NULL,
      computer_name VARCHAR(500) NULL,
      gpu VARCHAR(500) NULL,
      country VARCHAR(100) NULL,
      log_date VARCHAR(10) NULL COMMENT 'Normalized date in YYYY-MM-DD format',
      log_time VARCHAR(8) NOT NULL DEFAULT '00:00:00' COMMENT 'Normalized time in HH:mm:ss format (always string, default 00:00:00)',
      hwid VARCHAR(255) NULL,
      file_path TEXT NULL,
      antivirus VARCHAR(500) NULL,
      source_file VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_stealer_type (stealer_type),
      INDEX idx_os (os(255)),
      INDEX idx_ip_address (ip_address),
      INDEX idx_username (username(255)),
      INDEX idx_country (country),
      INDEX idx_hwid (hwid),
      INDEX idx_source_file (source_file),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)
  
  // Add log_time column if it doesn't exist (for existing databases)
  const dbConfig = getDbConfig()
  try {
    // Check if column exists first (MySQL doesn't support IF NOT EXISTS for ADD COLUMN)
    const columnCheck = await executeQuery(
      `
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'systeminformation' AND COLUMN_NAME = 'log_time'
    `,
      [dbConfig.database],
    )

    if ((columnCheck as any[]).length === 0) {
      console.log("➕ Adding log_time column to systeminformation table...")
      await executeQuery(`
        ALTER TABLE systeminformation 
        ADD COLUMN log_time VARCHAR(8) NOT NULL DEFAULT '00:00:00'
        COMMENT 'Normalized time in HH:mm:ss format (always string, default 00:00:00)' 
        AFTER log_date
      `)
      console.log("✅ log_time column added successfully")
    } else {
      console.log("✅ log_time column already exists")
    }
  } catch (error) {
    // Column might already exist or other error, log but don't fail
    console.log('⚠️ Error checking/adding log_time column:', error);
  }
  
  // Update log_date column size if needed (for existing databases)
  try {
    await executeQuery(`
      ALTER TABLE systeminformation 
      MODIFY COLUMN log_date VARCHAR(10) NULL 
      COMMENT 'Normalized date in YYYY-MM-DD format'
    `);
  } catch (error) {
    // Ignore error if column doesn't exist or modification fails
    console.log('⚠️ Could not modify log_date column:', error);
  }

  // Create app_settings table
  await createAppSettingsTable()

  // Create domain monitoring tables
  await createMonitoringTables()
}

/**
 * Create domain monitoring tables for webhook alerts
 */
async function createMonitoringTables() {
  try {
    // Create domain_monitors table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS domain_monitors (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL COMMENT 'Monitor display name',
        domains TEXT NOT NULL COMMENT 'JSON array of domains to monitor',
        match_mode ENUM('credential', 'url', 'both') NOT NULL DEFAULT 'both' COMMENT 'What to match',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by INT NULL COMMENT 'User who created this monitor',
        last_triggered_at TIMESTAMP NULL COMMENT 'Last time this monitor was triggered',
        total_alerts INT NOT NULL DEFAULT 0 COMMENT 'Total alerts sent',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_domain_monitors_is_active (is_active),
        INDEX idx_domain_monitors_created_by (created_by),
        INDEX idx_domain_monitors_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create monitor_webhooks table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS monitor_webhooks (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL COMMENT 'Webhook display name',
        url TEXT NOT NULL COMMENT 'Webhook URL',
        secret VARCHAR(255) NULL COMMENT 'Optional HMAC secret for signing payloads',
        headers TEXT NULL COMMENT 'Optional JSON custom headers',
        is_active TINYINT(1) NOT NULL DEFAULT 1,
        created_by INT NULL COMMENT 'User who created this webhook',
        last_triggered_at TIMESTAMP NULL COMMENT 'Last time this webhook was called',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_monitor_webhooks_is_active (is_active),
        INDEX idx_monitor_webhooks_created_by (created_by)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create monitor_webhook_map table (many-to-many)
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS monitor_webhook_map (
        id INT AUTO_INCREMENT PRIMARY KEY,
        monitor_id INT NOT NULL,
        webhook_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (monitor_id) REFERENCES domain_monitors(id) ON DELETE CASCADE,
        FOREIGN KEY (webhook_id) REFERENCES monitor_webhooks(id) ON DELETE CASCADE,
        UNIQUE INDEX idx_monitor_webhook_map_unique (monitor_id, webhook_id),
        INDEX idx_monitor_webhook_map_monitor (monitor_id),
        INDEX idx_monitor_webhook_map_webhook (webhook_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Create monitor_alerts table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS monitor_alerts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        monitor_id INT NOT NULL,
        webhook_id INT NOT NULL,
        device_id VARCHAR(255) NULL COMMENT 'Device that triggered the alert',
        upload_batch VARCHAR(255) NULL COMMENT 'Upload batch that triggered the alert',
        matched_domain VARCHAR(255) NOT NULL COMMENT 'Domain that was matched',
        match_type ENUM('credential_email', 'url', 'both') NOT NULL COMMENT 'Type of match found',
        credential_match_count INT NOT NULL DEFAULT 0,
        url_match_count INT NOT NULL DEFAULT 0,
        payload_sent LONGTEXT NULL COMMENT 'JSON payload sent to webhook',
        status ENUM('success', 'failed', 'retrying') NOT NULL DEFAULT 'success',
        http_status INT NULL,
        error_message TEXT NULL,
        retry_count INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (monitor_id) REFERENCES domain_monitors(id) ON DELETE CASCADE,
        FOREIGN KEY (webhook_id) REFERENCES monitor_webhooks(id) ON DELETE CASCADE,
        INDEX idx_monitor_alerts_monitor_id (monitor_id),
        INDEX idx_monitor_alerts_webhook_id (webhook_id),
        INDEX idx_monitor_alerts_device_id (device_id),
        INDEX idx_monitor_alerts_status (status),
        INDEX idx_monitor_alerts_created_at (created_at),
        INDEX idx_monitor_alerts_matched_domain (matched_domain)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    console.log("✅ Domain monitoring tables ensured")
  } catch (error) {
    console.error("❌ Error creating monitoring tables:", error)
    // Don't throw - allow graceful degradation
  }
}

/**
 * Create app_settings table if it doesn't exist
 * This is called separately to ensure it's created even if initializeDatabase wasn't called
 */
export async function ensureAppSettingsTable() {
  try {
    await createAppSettingsTable()
  } catch (error) {
    console.error("Error ensuring app_settings table:", error)
    // Don't throw - allow graceful degradation
  }
}

async function createAppSettingsTable() {
  try {
    // Create app_settings table
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        key_name VARCHAR(255) UNIQUE NOT NULL,
        value TEXT NOT NULL,
        description TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_key_name (key_name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `)

    // Insert default settings if they don't exist
    // Use INSERT ... ON DUPLICATE KEY UPDATE to prevent race condition errors
    // This ensures that if multiple requests try to insert the same key simultaneously,
    // only one will succeed and others will be ignored without error
    await executeQuery(
      'INSERT INTO app_settings (key_name, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_name = key_name',
      ['upload_max_file_size', '10737418240', 'Maximum file upload size in bytes (default: 10GB)']
    )

    await executeQuery(
      'INSERT INTO app_settings (key_name, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_name = key_name',
      ['upload_chunk_size', '10485760', 'Chunk size for large file uploads in bytes (default: 10MB)']
    )

    await executeQuery(
      'INSERT INTO app_settings (key_name, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_name = key_name',
      ['upload_max_concurrent_chunks', '3', 'Maximum concurrent chunk uploads (default: 3)']
    )

    // Insert default batch size settings
    await executeQuery(
      'INSERT INTO app_settings (key_name, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_name = key_name',
      ['db_batch_size_credentials', '1000', 'Batch size for credentials bulk insert (default: 1000)']
    )

    await executeQuery(
      'INSERT INTO app_settings (key_name, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_name = key_name',
      ['db_batch_size_password_stats', '500', 'Batch size for password stats bulk insert (default: 500)']
    )

    await executeQuery(
      'INSERT INTO app_settings (key_name, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_name = key_name',
      ['db_batch_size_files', '500', 'Batch size for files bulk insert (default: 500)']
    )

    await executeQuery(
      'INSERT INTO app_settings (key_name, value, description) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE key_name = key_name',
      ['file_write_parallel_limit', '10', 'Maximum concurrent file writes (default: 10)']
    )

    console.log("✅ app_settings table ensured")
  } catch (error) {
    console.error("Error creating app_settings table:", error)
    throw error
  }
}

/**
 * Ensure performance indexes exist for optimal query performance
 * This is called automatically during database initialization
 * Safe to call multiple times - uses IF NOT EXISTS
 * Can also be called separately if needed
 */
// Flag to prevent multiple simultaneous calls
let indexesEnsuring = false
let indexesEnsured = false

export async function ensurePerformanceIndexes() {
  // Prevent multiple simultaneous calls
  if (indexesEnsured) {
    return
  }

  // If already running, wait a bit and return (another process is handling it)
  if (indexesEnsuring) {
    // Wait up to 5 seconds for the other process to finish
    for (let i = 0; i < 50; i++) {
      await new Promise(resolve => setTimeout(resolve, 100))
      if (indexesEnsured) return
    }
    return
  }

  indexesEnsuring = true
  const dbConfig = getDbConfig()

  try {
    console.log("🔧 Ensuring performance indexes exist...")

    // Check and create indexes one by one to avoid errors if they already exist
    // Note: Using CREATE INDEX without IF NOT EXISTS for compatibility with older MySQL versions
    // We check if index exists first before creating
    const indexes = [
      {
        name: 'idx_credentials_browser_device',
        table: 'credentials',
        sql: 'CREATE INDEX idx_credentials_browser_device ON credentials(browser, device_id)',
        description: 'Browser analysis queries'
      },
      {
        name: 'idx_credentials_tld_device',
        table: 'credentials',
        sql: 'CREATE INDEX idx_credentials_tld_device ON credentials(tld, device_id)',
        description: 'TLD queries'
      },
      {
        name: 'idx_files_is_directory',
        table: 'files',
        sql: 'CREATE INDEX idx_files_is_directory ON files(is_directory)',
        description: 'File count queries'
      },
      {
        name: 'idx_password_stats_password_device',
        table: 'password_stats',
        sql: 'CREATE INDEX idx_password_stats_password_device ON password_stats(password(100), device_id)',
        description: 'Top passwords queries (critical)'
      },
      {
        name: 'idx_software_name_version_device',
        table: 'software',
        sql: 'CREATE INDEX idx_software_name_version_device ON software(software_name(100), version(100), device_id)',
        description: 'Software analysis queries (using prefix to avoid key length limit)'
      },
      {
        name: 'idx_credentials_domain_url_prefix',
        table: 'credentials',
        sql: 'CREATE INDEX idx_credentials_domain_url_prefix ON credentials(domain, url(255))',
        description: 'Domain and URL prefix searches (for domain-search optimization)'
      }
    ]

    for (const index of indexes) {
      try {
        // Check if index already exists
        const indexCheck = await executeQuery(
          `
          SELECT COUNT(*) as count
          FROM INFORMATION_SCHEMA.STATISTICS
          WHERE TABLE_SCHEMA = ? 
            AND TABLE_NAME = ? 
            AND INDEX_NAME = ?
          `,
          [dbConfig.database, index.table, index.name]
        ) as any[]

        const indexExists = indexCheck.length > 0 && indexCheck[0].count > 0

        if (!indexExists) {
          console.log(`➕ Creating index: ${index.name} (${index.description})`)
          try {
            await executeQuery(index.sql)
            console.log(`✅ Created index: ${index.name}`)
          } catch (createError: any) {
            // Handle duplicate key error (race condition - another process created it)
            const errorMessage = createError?.message || String(createError)
            const errorCode = createError?.code || createError?.errno
            
            if (errorCode === 1061 || errorCode === 'ER_DUP_KEYNAME' || 
                errorMessage.includes('Duplicate key name') || 
                errorMessage.includes('already exists')) {
              console.log(`✅ Index already exists: ${index.name} (created by another process)`)
            } else {
              // Re-throw other errors (like key too long)
              throw createError
            }
          }
        } else {
          console.log(`✅ Index already exists: ${index.name}`)
        }
      } catch (error) {
        // Handle other errors (like key too long, table doesn't exist, etc.)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const errorCode = (error as any)?.code || (error as any)?.errno
        
        // Key too long - log warning but continue
        if (errorCode === 1071 || errorCode === 'ER_TOO_LONG_KEY' || 
            errorMessage.includes('too long')) {
          console.warn(`⚠️  Index ${index.name} cannot be created: key too long. This is OK, query will still work but may be slower.`)
        } else {
          console.warn(`⚠️  Could not create index ${index.name}:`, errorMessage)
        }
        // Continue with other indexes - don't fail the whole process
      }
    }

    console.log("✅ Performance indexes ensured")
    indexesEnsured = true
  } catch (error) {
    console.error("❌ Error ensuring performance indexes:", error)
    // Don't throw - allow graceful degradation (app will work but might be slower)
  } finally {
    indexesEnsuring = false
  }
}
