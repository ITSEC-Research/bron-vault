import mysql from "mysql2/promise"

// MySQL connection configuration
const dbConfig = {
  host: process.env.MYSQL_HOST || "localhost",
  port: Number.parseInt(process.env.MYSQL_PORT || "3306"),
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "stealer_logs",
  charset: "utf8mb4",
}

// Create connection pool with optimized settings for high volume
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 50,
  queueLimit: 0,
})

export { pool }

export async function executeQuery(query: string, params: any[] = []) {
  try {
    const [results] = await pool.execute(query, params)
    return results
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  }
}

export async function initializeDatabase() {
  try {
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
      INDEX idx_device_id (device_id),
      INDEX idx_file_name (file_name),
      INDEX idx_created_at (created_at),
      FULLTEXT idx_content (content)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
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
      cache_data JSON,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cache_key (cache_key),
      INDEX idx_expires_at (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `)

  // Create search_cache table
  await executeQuery(`
    CREATE TABLE IF NOT EXISTS search_cache (
      id INT AUTO_INCREMENT PRIMARY KEY,
      search_query VARCHAR(500) NOT NULL,
      search_type ENUM('email', 'domain') NOT NULL,
      results JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_search (search_query, search_type),
      INDEX idx_created (created_at)
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
  } catch (error) {
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
      log_date VARCHAR(100) NULL,
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

  // Create app_settings table
  await createAppSettingsTable()
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
    const existingSettings = await executeQuery(
      'SELECT key_name FROM app_settings WHERE key_name IN (?, ?, ?)',
      ['upload_max_file_size', 'upload_chunk_size', 'upload_max_concurrent_chunks']
    ) as any[]

    const existingKeys = new Set((existingSettings || []).map((s: any) => s.key_name))

    if (!existingKeys.has('upload_max_file_size')) {
      await executeQuery(
        'INSERT INTO app_settings (key_name, value, description) VALUES (?, ?, ?)',
        ['upload_max_file_size', '10737418240', 'Maximum file upload size in bytes (default: 10GB)']
      )
    }

    if (!existingKeys.has('upload_chunk_size')) {
      await executeQuery(
        'INSERT INTO app_settings (key_name, value, description) VALUES (?, ?, ?)',
        ['upload_chunk_size', '10485760', 'Chunk size for large file uploads in bytes (default: 10MB)']
      )
    }

    if (!existingKeys.has('upload_max_concurrent_chunks')) {
      await executeQuery(
        'INSERT INTO app_settings (key_name, value, description) VALUES (?, ?, ?)',
        ['upload_max_concurrent_chunks', '3', 'Maximum concurrent chunk uploads (default: 3)']
      )
    }

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
