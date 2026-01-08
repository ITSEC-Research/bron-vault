/**
 * =====================================================
 * Migration: Add TOTP/2FA Support (v1.3.0)
 * =====================================================
 * 
 * Menambahkan dukungan Two-Factor Authentication (2FA) ke users table.
 * 
 * Perubahan:
 * - Tambah kolom `totp_secret` VARCHAR(255) untuk menyimpan secret key
 * - Tambah kolom `totp_enabled` BOOLEAN untuk status 2FA
 * - Tambah kolom `backup_codes` TEXT untuk recovery codes
 * - Tambah index untuk totp_enabled queries
 * 
 * Usage:
 *   npx tsx scripts/migrate-add-totp.ts
 * 
 * Idempotent: Ya (aman dijalankan berulang kali)
 * Backwards Compatible: Ya (existing users tanpa 2FA)
 * 
 * =====================================================
 */

import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m"
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// Load .env.local or .env
async function loadEnv() {
  const envLocalPath = path.join(process.cwd(), ".env.local")
  const envPath = path.join(process.cwd(), ".env")
  
  let finalEnvPath: string
  if (existsSync(envLocalPath)) {
    finalEnvPath = envLocalPath
  } else if (existsSync(envPath)) {
    finalEnvPath = envPath
  } else {
    log("❌ Environment file not found!", 'red')
    log("   Please create .env.local with MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE", 'yellow')
    process.exit(1)
  }

  const content = await readFile(finalEnvPath, "utf-8")
  for (const line of content.split("\n")) {
    const trimmed = line.trim()
    if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
      const [key, ...valueParts] = trimmed.split("=")
      const value = valueParts.join("=").replace(/^["']|["']$/g, "")
      process.env[key] = value
    }
  }
}

async function runMigration() {
  log("\n╔════════════════════════════════════════════════════════╗", 'cyan')
  log("║     BronVault TOTP/2FA Migration Script                ║", 'cyan')
  log("╚════════════════════════════════════════════════════════╝\n", 'cyan')

  // Load environment
  await loadEnv()

  // Dynamic import mysql2 after env is loaded
  const mysql = await import("mysql2/promise")

  const config = {
    host: process.env.MYSQL_HOST || "localhost",
    port: parseInt(process.env.MYSQL_PORT || "3306"),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE || "bronvault"
  }

  log(`📦 Connecting to MySQL at ${config.host}:${config.port}...`, 'blue')

  let connection
  try {
    connection = await mysql.createConnection(config)
    log("✅ Connected to database", 'green')

    // Check if columns exist
    log("\n🔍 Checking current schema...", 'blue')
    
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
    `, [config.database]) as any[]

    const existingColumns = columns.map((c: any) => c.COLUMN_NAME)
    
    log(`   Found ${existingColumns.length} columns in users table`, 'cyan')

    // Migration 1: Add totp_secret column
    if (!existingColumns.includes('totp_secret')) {
      log("\n📝 Adding totp_secret column...", 'yellow')
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN totp_secret VARCHAR(255) DEFAULT NULL
        COMMENT 'TOTP secret key (base32 encoded) for 2FA'
      `)
      log("   ✅ totp_secret column added", 'green')
    } else {
      log("\n   ℹ️  totp_secret column already exists", 'cyan')
    }

    // Migration 2: Add totp_enabled column
    if (!existingColumns.includes('totp_enabled')) {
      log("\n📝 Adding totp_enabled column...", 'yellow')
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN totp_enabled BOOLEAN DEFAULT FALSE
        COMMENT 'Whether 2FA is enabled for this user'
      `)
      log("   ✅ totp_enabled column added", 'green')
    } else {
      log("\n   ℹ️  totp_enabled column already exists", 'cyan')
    }

    // Migration 3: Add backup_codes column
    if (!existingColumns.includes('backup_codes')) {
      log("\n📝 Adding backup_codes column...", 'yellow')
      await connection.query(`
        ALTER TABLE users 
        ADD COLUMN backup_codes TEXT DEFAULT NULL
        COMMENT 'JSON array of backup codes for 2FA recovery'
      `)
      log("   ✅ backup_codes column added", 'green')
    } else {
      log("\n   ℹ️  backup_codes column already exists", 'cyan')
    }

    // Migration 4: Add index for totp_enabled
    log("\n📝 Checking index for totp_enabled...", 'yellow')
    const [indexes] = await connection.query(`
      SHOW INDEX FROM users WHERE Key_name = 'idx_totp_enabled'
    `) as any[]

    if (indexes.length === 0) {
      log("   Creating index idx_totp_enabled...", 'yellow')
      await connection.query(`
        CREATE INDEX idx_totp_enabled ON users(totp_enabled)
      `)
      log("   ✅ Index created", 'green')
    } else {
      log("   ℹ️  Index idx_totp_enabled already exists", 'cyan')
    }

    // Show final schema
    log("\n📋 Current users table columns:", 'blue')
    const [finalColumns] = await connection.query(`
      SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'users'
      ORDER BY ORDINAL_POSITION
    `, [config.database]) as any[]

    console.table(finalColumns.map((c: any) => ({
      Column: c.COLUMN_NAME,
      Type: c.COLUMN_TYPE,
      Nullable: c.IS_NULLABLE,
      Default: c.COLUMN_DEFAULT,
      Comment: c.COLUMN_COMMENT?.substring(0, 40) || ''
    })))

    // Summary
    log("\n╔════════════════════════════════════════════════════════╗", 'green')
    log("║     Migration completed successfully! ✅               ║", 'green')
    log("╚════════════════════════════════════════════════════════╝", 'green')
    
    log("\n📌 Next steps:", 'cyan')
    log("   1. Users can now enable 2FA from User Settings page", 'reset')
    log("   2. Admin can disable 2FA by setting totp_enabled=0 in DB", 'reset')
    log("   3. Admin can view totp_secret for user recovery if needed", 'reset')

  } catch (error: any) {
    log(`\n❌ Migration failed: ${error.message}`, 'red')
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      log("   Check your MySQL credentials in .env.local", 'yellow')
    } else if (error.code === 'ECONNREFUSED') {
      log("   Make sure MySQL server is running", 'yellow')
    }
    process.exit(1)
  } finally {
    if (connection) {
      await connection.end()
      log("\n👋 Database connection closed", 'blue')
    }
  }
}

// Run migration
runMigration().catch(console.error)
