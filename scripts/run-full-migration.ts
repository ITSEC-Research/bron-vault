/**
 * Full Migration Runner: Execute both schema and data migration
 * Automatically loads credentials from .env.local
 * 
 * This script will:
 * 1. Run schema migration (adds file_type column, indexes, etc.)
 * 2. Run data migration (migrates all files from DB to disk)
 * 
 * Usage:
 *   npx tsx scripts/run-full-migration.ts
 * 
 * Prerequisites:
 *   - .env.local file with MYSQL_* credentials
 *   - Database must be running and accessible
 */

import { readFile } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

// Load .env.local or .env
async function loadEnv() {
  // Try .env.local first, then fallback to .env
  const envLocalPath = path.join(process.cwd(), ".env.local")
  const envPath = path.join(process.cwd(), ".env")
  
  let finalEnvPath: string
  if (existsSync(envLocalPath)) {
    finalEnvPath = envLocalPath
  } else if (existsSync(envPath)) {
    finalEnvPath = envPath
  } else {
    console.error("❌ Environment file not found!")
    console.error("   Please create .env.local or .env with MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE")
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
}

async function runSchemaMigration() {
  console.log("📋 Step 1: Running schema migration...\n")

  const { executeQuery } = await import("../lib/mysql")

  try {
    // Drop FULLTEXT index (check first)
    try {
      const indexCheck = (await executeQuery(
        `SELECT COUNT(*) as count 
         FROM INFORMATION_SCHEMA.STATISTICS 
         WHERE table_schema = DATABASE() 
           AND table_name = 'files' 
           AND index_name = 'idx_content'`
      )) as any[]
      
      if (indexCheck[0]?.count > 0) {
        await executeQuery("ALTER TABLE files DROP INDEX idx_content")
        console.log("✅ Dropped FULLTEXT index")
      } else {
        console.log("ℹ️  FULLTEXT index already removed")
      }
    } catch (e: any) {
      console.log("⚠️  Could not check/drop FULLTEXT index (non-critical):", e.message)
    }

    // Add index for local_file_path
    try {
      await executeQuery("CREATE INDEX idx_local_file_path ON files(local_file_path(255))")
      console.log("✅ Created index on local_file_path")
    } catch (e: any) {
      if (e.message?.includes("Duplicate key") || e.message?.includes("already exists")) {
        console.log("ℹ️  Index on local_file_path already exists")
      } else {
        throw e
      }
    }

    // Add file_type column
    try {
      await executeQuery(
        "ALTER TABLE files ADD COLUMN file_type ENUM('text', 'binary', 'unknown') DEFAULT 'unknown'"
      )
      console.log("✅ Added file_type column")
    } catch (e: any) {
      if (e.message?.includes("Duplicate column") || e.message?.includes("already exists")) {
        console.log("ℹ️  file_type column already exists")
      } else {
        throw e
      }
    }

    // Update comment
    try {
      await executeQuery(
        "ALTER TABLE files COMMENT = 'Files table: metadata only. All file contents stored on disk via local_file_path'"
      )
      console.log("✅ Updated table comment")
    } catch (_e: any) {
      console.log("⚠️  Could not update comment (non-critical)")
    }

    console.log("\n✅ Schema migration completed!\n")
    // Don't close pool here - it will be used by data migration
    return true
  } catch (error) {
    console.error("❌ Schema migration failed:", error)
    // Don't close pool here - let main() handle it
    throw error
  }
}

async function runDataMigration() {
  console.log("📋 Step 2: Running data migration...\n")

  const { migrateExistingFiles, checkMigrationStatus } = await import("./008_migrate_existing_files_to_disk")

  try {
    // Check status first
    const status = await checkMigrationStatus()
    console.log("📊 Current Status:")
    console.log(`   Total files: ${status.totalFiles}`)
    console.log(`   Files with content in DB: ${status.filesWithContent}`)
    console.log(`   Files with local_file_path: ${status.filesWithLocalPath}`)
    console.log(`   Files to migrate: ${status.filesToMigrate}\n`)

    if (status.filesToMigrate === 0) {
      console.log("✅ No files to migrate. All files already migrated.\n")
      return { migrated: 0, errors: 0 }
    }

    // Run migration
    const result = await migrateExistingFiles(1000, true)

    console.log(`\n✅ Data migration completed!`)
    console.log(`   Migrated: ${result.migrated} files`)
    console.log(`   Skipped: ${result.skipped} files`)
    console.log(`   Errors: ${result.errors} files\n`)

    if (result.errors > 0) {
      console.log(`⚠️  Some files failed to migrate. Check error details above.\n`)
    }

    return result
  } catch (error) {
    console.error("❌ Data migration failed:", error)
    throw error
  }
}

async function main() {
  // Load environment variables FIRST before importing mysql
  console.log("🚀 Starting complete migration process...\n")
  console.log("=".repeat(60))
  console.log()

  console.log("📝 Loading credentials from .env.local...\n")
  await loadEnv()
  const dbName = process.env.MYSQL_DATABASE || "unknown"
  console.log(`✅ Loaded credentials for database: ${dbName}\n`)

  // Import pool AFTER env is loaded to ensure correct credentials
  const { pool } = await import("../lib/mysql")
  
  try {
    // Step 1: Schema Migration
    await runSchemaMigration()

    // Step 2: Data Migration
    const _result = await runDataMigration()

    // Final verification
    console.log("=".repeat(60))
    console.log("📊 Final Verification:\n")

    const { checkMigrationStatus } = await import("./008_migrate_existing_files_to_disk")
    const finalStatus = await checkMigrationStatus()
    console.log(`   Total files: ${finalStatus.totalFiles}`)
    console.log(`   Files with local_file_path: ${finalStatus.filesWithLocalPath}`)
    console.log(`   Files still to migrate: ${finalStatus.filesToMigrate}`)

    if (finalStatus.filesToMigrate === 0) {
      console.log("\n✅ Migration completed successfully!")
      console.log("   All files have been migrated to disk.\n")
      console.log("🎉 You can now use the application with file-based storage!\n")
    } else {
      console.log(`\n⚠️  Warning: ${finalStatus.filesToMigrate} files still need migration.`)
      console.log("   You may need to run the migration again.\n")
    }

    // Close pool after all migrations are complete
    try {
      await pool.end()
    } catch (_e) {
      // Ignore if pool already closed
    }
    process.exit(0)
  } catch (error) {
    console.error("\n❌ Migration failed:", error)
    // Close pool on error
    try {
      await pool.end()
    } catch (_e) {
      // Ignore if pool already closed
    }
    process.exit(1)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

