/**
 * =====================================================
 * Migration: Add User Roles (v1.2.0)
 * =====================================================
 * 
 * Menambahkan role-based access control ke users table.
 * 
 * Perubahan:
 * - Tambah kolom `role` ENUM('admin', 'analyst') ke users
 * - Tambah index untuk role queries
 * 
 * Usage:
 *   npm run migrate:user-roles
 * 
 * Idempotent: Ya (aman dijalankan berulang kali)
 * Backwards Compatible: Ya (existing users tetap admin)
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
      process.env[key.trim()] = value.trim()
    }
  }
  
  // Set defaults for Docker environment (kalau MYSQL_HOST tidak diset)
  if (!process.env.MYSQL_HOST) {
    process.env.MYSQL_HOST = '127.0.0.1'
  }
  if (!process.env.MYSQL_PORT) {
    process.env.MYSQL_PORT = '3306'
  }
}

// Helper: Check if column exists
async function columnExists(executeQuery: any, table: string, column: string): Promise<boolean> {
  const result = await executeQuery(
    `SELECT COUNT(*) as count 
     FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = ? 
     AND COLUMN_NAME = ?`,
    [table, column]
  ) as any[]
  return result[0]?.count > 0
}

// Helper: Check if index exists
async function indexExists(executeQuery: any, table: string, indexName: string): Promise<boolean> {
  const result = await executeQuery(
    `SELECT COUNT(*) as count 
     FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = ? 
     AND INDEX_NAME = ?`,
    [table, indexName]
  ) as any[]
  return result[0]?.count > 0
}

// Main migration
async function runMigration() {
  log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan')
  log("🔄 Migration: Add User Roles (v1.2.0)", 'cyan')
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n", 'cyan')
  
  // Load environment
  log("📝 Loading credentials...", 'blue')
  await loadEnv()
  const dbName = process.env.MYSQL_DATABASE || "unknown"
  log(`✅ Database: ${dbName}\n`, 'green')
  
  // Import mysql AFTER env is loaded
  const { executeQuery, pool } = await import("../lib/mysql")
  
  try {
    // Test connection
    await executeQuery("SELECT 1")
    log("✅ Database connection successful\n", 'green')
    
    let updated = 0
    let skipped = 0
    
    // Step 1: Add role column
    log("Step 1: Add users.role column", 'blue')
    if (await columnExists(executeQuery, 'users', 'role')) {
      log("   ℹ️  Column already exists - skipped", 'yellow')
      skipped++
    } else {
      await executeQuery(
        `ALTER TABLE users ADD COLUMN role ENUM('admin', 'analyst') NOT NULL DEFAULT 'admin' AFTER name`
      )
      log("   ✅ Added column: role ENUM('admin', 'analyst') DEFAULT 'admin'", 'green')
      updated++
    }
    
    // Step 2: Add index for role
    log("\nStep 2: Add idx_users_role index", 'blue')
    if (await indexExists(executeQuery, 'users', 'idx_users_role')) {
      log("   ℹ️  Index already exists - skipped", 'yellow')
      skipped++
    } else {
      await executeQuery(`CREATE INDEX idx_users_role ON users(role)`)
      log("   ✅ Created index: idx_users_role", 'green')
      updated++
    }
    
    // Summary
    log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", 'cyan')
    
    if (updated > 0) {
      log(`\n✅ Migration completed! ${updated} change(s) applied.`, 'green')
    } else {
      log(`\nℹ️  Migration already applied. Nothing to do.`, 'yellow')
    }
    
    log("\n📌 Role values:", 'blue')
    log("   • admin   - Full access (upload, settings, user management)", 'reset')
    log("   • analyst - Read-only (view/search data only)\n", 'reset')
    
    // Close pool
    await pool.end()
    process.exit(0)
  } catch (error: any) {
    log(`\n❌ Migration failed: ${error.message}`, 'red')
    log("\nTroubleshooting:", 'yellow')
    log("  1. Make sure MySQL is running", 'yellow')
    log("  2. Check credentials in .env.local", 'yellow')
    log("  3. Run docker-compose up -d if using Docker\n", 'yellow')
    
    try {
      await pool.end()
    } catch (e) {
      // Ignore
    }
    process.exit(1)
  }
}

// Run
runMigration()
