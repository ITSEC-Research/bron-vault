/**
 * Migration Script: Migrate Existing Files from Database to Disk
 * 
 * Purpose: Migrate files that have content in database to disk storage
 * 
 * IMPORTANT: This script MUST be run before using the new file-based storage system.
 * After migration, all files will be accessed from disk, not from database.
 * 
 * Usage:
 *   npx ts-node scripts/008_migrate_existing_files_to_disk.ts
 * 
 * Or import and call from another script:
 *   import { migrateExistingFiles } from './scripts/008_migrate_existing_files_to_disk'
 *   await migrateExistingFiles()
 * 
 * Prerequisites:
 *   1. Run schema migration first: scripts/007_migrate_to_file_based_storage.sql
 *   2. Ensure uploads/extracted_files directory exists and is writable
 */

import { executeQuery, pool } from "../lib/mysql"
import { writeFile, mkdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

interface FileRecord {
  id: number
  device_id: string
  file_path: string
  file_name: string
  content: string
  local_file_path: string | null
}

/**
 * Migrate existing files from database to disk
 * Only migrates files that have content in DB but no local_file_path
 */
export async function migrateExistingFiles(
  batchSize: number = 1000,
  logProgress: boolean = true
): Promise<{
  total: number
  migrated: number
  skipped: number
  errors: number
  errorDetails: Array<{ fileId: number; error: string }>
}> {
  const stats = {
    total: 0,
    migrated: 0,
    skipped: 0,
    errors: 0,
    errorDetails: [] as Array<{ fileId: number; error: string }>,
  }

  try {
    // Get all files that have content in DB but no local_file_path
    // Process in batches to avoid memory issues
    let hasMore = true

    let lastId = 0
    while (hasMore) {
      // Use string interpolation for LIMIT to avoid prepared statement issues
      const files = (await executeQuery(
        `SELECT id, device_id, file_path, file_name, content, local_file_path
         FROM files 
         WHERE content IS NOT NULL 
           AND (local_file_path IS NULL OR local_file_path = '')
           AND is_directory = FALSE
           AND id > ?
         ORDER BY id
         LIMIT ${Number(batchSize)}`,
        [lastId],
      )) as FileRecord[]

      if (files.length === 0) {
        hasMore = false
        break
      }

      stats.total += files.length
      lastId = files[files.length - 1].id

      if (logProgress) {
        console.log(`📊 Processing batch: ${files.length} files (last ID: ${lastId})`)
      }

      for (const file of files) {
        try {
          // Migrate ALL files, even with empty content (for data integrity)
          const content = file.content || ""

          // Create file path
          const extractionBaseDir = path.join(process.cwd(), "uploads", "extracted_files")
          const deviceDir = path.join(extractionBaseDir, file.device_id)
          const safeFilePath = file.file_path.replace(/[<>:"|?*]/g, "_")
          const fullLocalPath = path.join(deviceDir, safeFilePath)

          // Create directory structure if needed
          const fileDir = path.dirname(fullLocalPath)
          if (!existsSync(fileDir)) {
            await mkdir(fileDir, { recursive: true })
          }

        // Check if file already exists on disk
        if (existsSync(fullLocalPath)) {
          // File already exists, just update local_file_path in DB
          const relativePath = path.relative(process.cwd(), fullLocalPath)
          const isTextFile = file.file_name.toLowerCase().match(/\.(txt|log|json|xml|html|htm|css|js|csv|ini|cfg|conf|md|sql|readme)$/i) ||
                            file.file_name.toLowerCase().includes("password") ||
                            !file.file_name.includes(".")
          const fileType = isTextFile ? "text" : "binary"
          await executeQuery(
            `UPDATE files 
             SET local_file_path = ?, content = NULL, file_type = ?
             WHERE id = ?`,
            [relativePath, fileType, file.id],
          )
          stats.migrated++
          if (logProgress) {
            const sizeLabel = content.length === 0 ? "empty" : "already on disk"
            console.log(`✅ Updated file ${file.id}: ${file.file_name} (${sizeLabel})`)
          }
          continue
        }

          // Write file to disk (even if empty - for data integrity)
          await writeFile(fullLocalPath, content, "utf-8")
          const relativePath = path.relative(process.cwd(), fullLocalPath)

          // Determine file type
          const isTextFile = file.file_name.toLowerCase().match(/\.(txt|log|json|xml|html|htm|css|js|csv|ini|cfg|conf|md|sql|readme)$/i) ||
                            file.file_name.toLowerCase().includes("password") ||
                            !file.file_name.includes(".")
          const fileType = isTextFile ? "text" : "binary"

          // Update database: set local_file_path, clear content, set file_type
          await executeQuery(
            `UPDATE files 
             SET local_file_path = ?, content = NULL, file_type = ?
             WHERE id = ?`,
            [relativePath, fileType, file.id],
          )

          stats.migrated++
          if (logProgress) {
            const size = content.length
            const sizeLabel = size === 0 ? "empty" : `${size} bytes`
            console.log(`✅ Migrated file ${file.id}: ${file.file_name} (${sizeLabel})`)
          }
        } catch (error) {
          stats.errors++
          const errorMsg = error instanceof Error ? error.message : "Unknown error"
          stats.errorDetails.push({ fileId: file.id, error: errorMsg })
          if (logProgress) {
            console.error(`❌ Error migrating file ${file.id}: ${errorMsg}`)
          }
        }
      }

      // Log progress for large migrations
      if (logProgress && files.length === batchSize) {
        console.log(`📊 Progress: ${stats.migrated} migrated, ${stats.errors} errors so far...`)
      }
    }

    if (logProgress) {
      console.log(`\n📊 Migration Summary:`)
      console.log(`   Total files processed: ${stats.total}`)
      console.log(`   Successfully migrated: ${stats.migrated}`)
      console.log(`   Skipped: ${stats.skipped}`)
      console.log(`   Errors: ${stats.errors}`)
      if (stats.errors > 0) {
        console.log(`\n⚠️  ${stats.errors} files failed to migrate. Check error details above.`)
      }
    }

    return stats
  } catch (error) {
    console.error("❌ Migration failed:", error)
    throw error
  }
}

/**
 * Check migration status
 */
export async function checkMigrationStatus(): Promise<{
  totalFiles: number
  filesWithContent: number
  filesWithLocalPath: number
  filesToMigrate: number
}> {
  const [totalResult, contentResult, localPathResult, toMigrateResult] = await Promise.all([
    executeQuery("SELECT COUNT(*) as count FROM files WHERE is_directory = FALSE") as Promise<any[]>,
    executeQuery("SELECT COUNT(*) as count FROM files WHERE content IS NOT NULL AND is_directory = FALSE") as Promise<any[]>,
    executeQuery("SELECT COUNT(*) as count FROM files WHERE local_file_path IS NOT NULL AND is_directory = FALSE") as Promise<any[]>,
    executeQuery(
      `SELECT COUNT(*) as count 
       FROM files 
       WHERE content IS NOT NULL 
         AND (local_file_path IS NULL OR local_file_path = '')
         AND is_directory = FALSE`
    ) as Promise<any[]>,
  ])

  return {
    totalFiles: totalResult[0]?.count || 0,
    filesWithContent: contentResult[0]?.count || 0,
    filesWithLocalPath: localPathResult[0]?.count || 0,
    filesToMigrate: toMigrateResult[0]?.count || 0,
  }
}

// Run migration if called directly
if (require.main === module) {
  ;(async () => {
    try {
      console.log("🚀 Starting migration of existing files to disk...\n")

      // Check status first
      const status = await checkMigrationStatus()
      console.log("📊 Current Status:")
      console.log(`   Total files: ${status.totalFiles}`)
      console.log(`   Files with content in DB: ${status.filesWithContent}`)
      console.log(`   Files with local_file_path: ${status.filesWithLocalPath}`)
      console.log(`   Files to migrate: ${status.filesToMigrate}\n`)

      if (status.filesToMigrate === 0) {
        console.log("✅ No files to migrate. All files already migrated or have no content.")
        process.exit(0)
      }

      // Run migration (process 1000 files per batch)
      const result = await migrateExistingFiles(1000, true)

      console.log(`\n✅ Migration completed!`)
      console.log(`   Migrated: ${result.migrated} files`)
      console.log(`   Errors: ${result.errors} files`)

      if (result.errors > 0) {
        console.log(`\n⚠️  Some files failed to migrate. Check error details above.`)
      }

      // Close database connection
      await pool.end()
      process.exit(0)
    } catch (error) {
      console.error("❌ Migration failed:", error)
      await pool.end()
      process.exit(1)
    }
  })()
}

