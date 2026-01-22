/**
 * =====================================================
 * BronVault Database Migration Script
 * =====================================================
 * 
 * Unified migration script for existing database upgrades.
 * 
 * For FRESH INSTALLS: Docker uses init-database.sql automatically.
 * For UPGRADES: Use db-sync page (/db-sync) OR run this script manually.
 * 
 * This script handles:
 * 1. Schema migration (via db-sync API - same logic)
 * 2. Data migration (files from DB to disk storage)
 * 3. Date normalization (log_date format fixes)
 * 
 * Usage:
 *   npx tsx scripts/migrate.ts              # Run full migration
 *   npx tsx scripts/migrate.ts --data-only  # Only migrate files to disk
 *   npx tsx scripts/migrate.ts --dates-only # Only normalize dates
 *   DRY_RUN=true npx tsx scripts/migrate.ts # Preview changes
 * 
 * Prerequisites:
 *   - .env or .env.local file with MySQL credentials
 *   - Database must be running and accessible
 *   - Backup your database before running!
 * 
 * =====================================================
 */

import { readFile, writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

// Colors for console output
const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  dim: "\x1b[2m"
}

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

// =====================================================
// Environment Loading
// =====================================================

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
    log("   Please create .env or .env.local with MySQL credentials", 'yellow')
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
  
  return finalEnvPath
}

// =====================================================
// 1. Schema Migration (using db-sync logic)
// =====================================================

async function runSchemaMigration(): Promise<{ success: boolean; changes: number }> {
  log("\n📋 STEP 1: Schema Migration", 'cyan')
  log("━".repeat(50), 'dim')

  const DRY_RUN = process.env.DRY_RUN === 'true'
  if (DRY_RUN) {
    log("🔍 DRY RUN MODE - No schema changes will be made\n", 'yellow')
  }

  const { executeQuery } = await import("../lib/mysql")
  let changes = 0

  try {
    // Check for common schema updates needed for older databases
    
    // 1. Add file_type column to files table
    try {
      await executeQuery(
        "ALTER TABLE files ADD COLUMN file_type ENUM('text', 'binary', 'unknown') DEFAULT 'unknown'"
      )
      log("✅ Added file_type column to files table", 'green')
      changes++
    } catch (e: any) {
      if (e.message?.includes("Duplicate column") || e.message?.includes("already exists")) {
        log("ℹ️  file_type column already exists", 'dim')
      } else {
        throw e
      }
    }

    // 2. Add local_file_path index
    try {
      await executeQuery("CREATE INDEX idx_local_file_path ON files(local_file_path(255))")
      log("✅ Created index on local_file_path", 'green')
      changes++
    } catch (e: any) {
      if (e.message?.includes("Duplicate key") || e.message?.includes("already exists")) {
        log("ℹ️  Index on local_file_path already exists", 'dim')
      } else {
        throw e
      }
    }

    // 3. Add log_time column to systeminformation
    try {
      await executeQuery(`
        ALTER TABLE systeminformation 
        ADD COLUMN log_time VARCHAR(8) NOT NULL DEFAULT '00:00:00'
        COMMENT 'Normalized time in HH:mm:ss format' 
        AFTER log_date
      `)
      log("✅ Added log_time column to systeminformation", 'green')
      changes++
    } catch (e: any) {
      if (e.message?.includes("Duplicate column") || e.message?.includes("already exists")) {
        log("ℹ️  log_time column already exists", 'dim')
      } else {
        throw e
      }
    }

    log(`\n✅ Schema migration completed! ${changes} change(s) applied.`, 'green')
    return { success: true, changes }
  } catch (error: any) {
    log(`\n❌ Schema migration failed: ${error.message}`, 'red')
    return { success: false, changes }
  }
}

// =====================================================
// 2. Data Migration (files from DB to disk)
// =====================================================

interface FileRecord {
  id: number
  device_id: string
  file_path: string
  file_name: string
  content: string
  local_file_path: string | null
}

async function runDataMigration(): Promise<{ migrated: number; skipped: number; errors: number }> {
  log("\n📋 STEP 2: Data Migration (Files to Disk)", 'cyan')
  log("━".repeat(50), 'dim')

  const DRY_RUN = process.env.DRY_RUN === 'true'
  if (DRY_RUN) {
    log("🔍 DRY RUN MODE - No files will be migrated\n", 'yellow')
  }

  const { executeQuery } = await import("../lib/mysql")
  const stats = { migrated: 0, skipped: 0, errors: 0 }

  try {
    // Check migration status first
    const toMigrateResult = await executeQuery(
      `SELECT COUNT(*) as count 
       FROM files 
       WHERE content IS NOT NULL 
         AND (local_file_path IS NULL OR local_file_path = '')
         AND is_directory = FALSE`
    ) as any[]
    
    const toMigrate = toMigrateResult[0]?.count || 0
    log(`📊 Found ${toMigrate} files to migrate to disk\n`)

    if (toMigrate === 0) {
      log("✅ No files to migrate. All files already on disk.", 'green')
      return stats
    }

    if (DRY_RUN) {
      log(`🔍 Would migrate ${toMigrate} files to disk`, 'yellow')
      return { migrated: toMigrate, skipped: 0, errors: 0 }
    }

    // Process in batches
    const BATCH_SIZE = 1000
    let lastId = 0
    let hasMore = true

    while (hasMore) {
      const files = await executeQuery(
        `SELECT id, device_id, file_path, file_name, content, local_file_path
         FROM files 
         WHERE content IS NOT NULL 
           AND (local_file_path IS NULL OR local_file_path = '')
           AND is_directory = FALSE
           AND id > ?
         ORDER BY id
         LIMIT ${BATCH_SIZE}`,
        [lastId]
      ) as FileRecord[]

      if (files.length === 0) {
        hasMore = false
        break
      }

      lastId = files[files.length - 1].id
      log(`📦 Processing batch of ${files.length} files...`, 'blue')

      for (const file of files) {
        try {
          const content = file.content || ""
          const extractionBaseDir = path.join(process.cwd(), "uploads", "extracted_files")
          const deviceDir = path.join(extractionBaseDir, file.device_id)
          const safeFilePath = file.file_path.replace(/[<>:"|?*]/g, "_")
          const fullLocalPath = path.join(deviceDir, safeFilePath)

          // Create directory
          const fileDir = path.dirname(fullLocalPath)
          if (!existsSync(fileDir)) {
            await mkdir(fileDir, { recursive: true })
          }

          // Write file if not exists
          if (!existsSync(fullLocalPath)) {
            await writeFile(fullLocalPath, content, "utf-8")
          }

          const relativePath = path.relative(process.cwd(), fullLocalPath)
          const isTextFile = /\.(txt|log|json|xml|html|css|js|csv|ini|cfg|conf|md|sql)$/i.test(file.file_name) ||
                            file.file_name.toLowerCase().includes("password")
          const fileType = isTextFile ? "text" : "binary"

          // Update database
          await executeQuery(
            `UPDATE files SET local_file_path = ?, content = NULL, file_type = ? WHERE id = ?`,
            [relativePath, fileType, file.id]
          )

          stats.migrated++
        } catch (error: any) {
          stats.errors++
          log(`❌ Error migrating file ${file.id}: ${error.message}`, 'red')
        }
      }

      log(`   Progress: ${stats.migrated} migrated, ${stats.errors} errors`, 'dim')
    }

    log(`\n✅ Data migration completed!`, 'green')
    log(`   - Migrated: ${stats.migrated} files`)
    log(`   - Errors: ${stats.errors} files`)
    
    return stats
  } catch (error: any) {
    log(`\n❌ Data migration failed: ${error.message}`, 'red')
    return stats
  }
}

// =====================================================
// 3. Date Normalization
// =====================================================

async function runDateNormalization(): Promise<{ updated: number; skipped: number; failed: number }> {
  log("\n📋 STEP 3: Date Normalization", 'cyan')
  log("━".repeat(50), 'dim')

  const DRY_RUN = process.env.DRY_RUN === 'true'
  if (DRY_RUN) {
    log("🔍 DRY RUN MODE - No dates will be normalized\n", 'yellow')
  }

  const { executeQuery } = await import("../lib/mysql")
  const { normalizeDateTime } = await import("../lib/system-information-parser/date-normalizer")
  const stats = { updated: 0, skipped: 0, failed: 0 }

  try {
    // Step 3a: Fix invalid dates (2000-01-01)
    log("📊 Fixing invalid log_date values (2000-01-01)...", 'blue')
    
    if (!DRY_RUN) {
      const fixResult = await executeQuery(
        `UPDATE systeminformation 
         SET log_date = DATE(created_at)
         WHERE log_date = '2000-01-01'`
      ) as any
      const fixed = fixResult?.affectedRows || 0
      if (fixed > 0) {
        log(`   ✅ Fixed ${fixed} invalid dates`, 'green')
        stats.updated += fixed
      } else {
        log("   ℹ️  No invalid dates to fix", 'dim')
      }
    }

    // Step 3b: Normalize date formats
    log("\n📊 Normalizing date formats...", 'blue')
    
    const totalResult = await executeQuery(
      'SELECT COUNT(*) as total FROM systeminformation WHERE log_date IS NOT NULL'
    ) as any[]
    const total = totalResult[0]?.total || 0
    log(`   Found ${total} records to check\n`)

    if (total === 0) {
      log("✅ No dates to normalize.", 'green')
      return stats
    }

    if (DRY_RUN) {
      log(`🔍 Would check and normalize up to ${total} date records`, 'yellow')
      return stats
    }

    // Process in batches
    const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '1000', 10)
    let offset = 0

    while (offset < total) {
      const records = await executeQuery(
        `SELECT id, log_date, log_time
         FROM systeminformation 
         WHERE log_date IS NOT NULL 
         LIMIT ${BATCH_SIZE} OFFSET ${offset}`
      ) as any[]

      if (records.length === 0) break

      for (const record of records) {
        try {
          const normalized = normalizeDateTime(record.log_date)
          const currentLogTime = record.log_time || '00:00:00'
          
          if (normalized.date === null) {
            if (record.log_date !== null) {
              await executeQuery(
                'UPDATE systeminformation SET log_date = NULL, log_time = ? WHERE id = ?',
                ['00:00:00', record.id]
              )
              stats.updated++
            } else {
              stats.skipped++
            }
          } else if (normalized.date) {
            const needsUpdate = normalized.date !== record.log_date ||
              (normalized.time && normalized.time !== '00:00:00' && currentLogTime !== normalized.time)

            if (needsUpdate) {
              await executeQuery(
                'UPDATE systeminformation SET log_date = ?, log_time = ? WHERE id = ?',
                [normalized.date, normalized.time || '00:00:00', record.id]
              )
              stats.updated++
            } else {
              stats.skipped++
            }
          } else {
            stats.failed++
          }
        } catch {
          stats.failed++
        }
      }

      offset += BATCH_SIZE
    }

    log(`\n✅ Date normalization completed!`, 'green')
    log(`   - Updated: ${stats.updated}`)
    log(`   - Skipped: ${stats.skipped} (already normalized)`)
    log(`   - Failed: ${stats.failed}`)

    return stats
  } catch (error: any) {
    log(`\n❌ Date normalization failed: ${error.message}`, 'red')
    return stats
  }
}

// =====================================================
// Main Entry Point
// =====================================================

async function main() {
  const args = process.argv.slice(2)
  const dataOnly = args.includes('--data-only')
  const datesOnly = args.includes('--dates-only')

  log("\n╔════════════════════════════════════════════════════════╗", 'cyan')
  log("║        BronVault Database Migration Script             ║", 'cyan')
  log("╚════════════════════════════════════════════════════════╝\n", 'cyan')

  const DRY_RUN = process.env.DRY_RUN === 'true'
  if (DRY_RUN) {
    log("⚠️  DRY RUN MODE - No changes will be made\n", 'yellow')
  }

  // Load environment
  log("📝 Loading environment...", 'blue')
  const envFile = await loadEnv()
  log(`   Using: ${envFile.includes('.env.local') ? '.env.local' : '.env'}`)
  log(`   Database: ${process.env.MYSQL_DATABASE}\n`, 'green')

  // Import mysql pool AFTER env is loaded
  const { pool } = await import("../lib/mysql")

  try {
    let schemaResult = { success: true, changes: 0 }
    let dataResult = { migrated: 0, skipped: 0, errors: 0 }
    let dateResult = { updated: 0, skipped: 0, failed: 0 }

    // Run migrations based on flags
    if (!dataOnly && !datesOnly) {
      schemaResult = await runSchemaMigration()
    }

    if (!datesOnly) {
      dataResult = await runDataMigration()
    }

    if (!dataOnly) {
      dateResult = await runDateNormalization()
    }

    // Summary
    log("\n╔════════════════════════════════════════════════════════╗", 'cyan')
    log("║               Migration Summary                        ║", 'cyan')
    log("╚════════════════════════════════════════════════════════╝", 'cyan')
    
    if (!dataOnly && !datesOnly) {
      log(`\nSchema: ${schemaResult.changes} changes applied`)
    }
    if (!datesOnly) {
      log(`Data: ${dataResult.migrated} files migrated, ${dataResult.errors} errors`)
    }
    if (!dataOnly) {
      log(`Dates: ${dateResult.updated} normalized, ${dateResult.skipped} skipped`)
    }

    const hasErrors = !schemaResult.success || dataResult.errors > 0 || dateResult.failed > 0
    
    if (hasErrors) {
      log("\n⚠️  Migration completed with some errors. Check details above.", 'yellow')
    } else {
      log("\n✅ All migrations completed successfully!", 'green')
    }

    if (DRY_RUN) {
      log("\n💡 Run without DRY_RUN=true to apply changes", 'yellow')
    }

    // Close pool
    await pool.end()
    process.exit(hasErrors ? 1 : 0)
  } catch (error: any) {
    log(`\n❌ Migration failed: ${error.message}`, 'red')
    try { await pool.end() } catch { /* ignore */ }
    process.exit(1)
  }
}

// Run
main()
