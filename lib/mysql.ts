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
}
