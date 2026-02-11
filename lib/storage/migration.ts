/**
 * Storage Migration Engine
 * 
 * Handles migration of files from local filesystem to S3-compatible object storage.
 * Provides progress tracking, resumability, and rollback support.
 */

import { executeQuery } from "@/lib/mysql"
import { settingsManager, SETTING_KEYS } from "@/lib/settings"
import { S3StorageProvider } from "./s3-storage"
import { resetStorageProvider, type S3Config } from "./index"
import { readFile, rm, readdir, rmdir } from "fs/promises"
import { existsSync } from "fs"
import path from "path"

export interface MigrationProgress {
  status: "idle" | "migrating" | "completed" | "failed"
  totalFiles: number
  migratedFiles: number
  failedFiles: number
  totalSizeBytes: number
  migratedSizeBytes: number
  currentFile: string
  startedAt: string | null
  completedAt: string | null
  error: string | null
  speed: number // bytes per second
  estimatedTimeRemaining: number // seconds
}

export interface MigrationLog {
  timestamp: string
  type: "info" | "success" | "warning" | "error"
  message: string
}

// In-memory migration state
let migrationState: MigrationProgress = {
  status: "idle",
  totalFiles: 0,
  migratedFiles: 0,
  failedFiles: 0,
  totalSizeBytes: 0,
  migratedSizeBytes: 0,
  currentFile: "",
  startedAt: null,
  completedAt: null,
  error: null,
  speed: 0,
  estimatedTimeRemaining: 0,
}

let migrationLogs: MigrationLog[] = []
let migrationAborted = false

/**
 * Get current migration progress
 */
export function getMigrationProgress(): MigrationProgress {
  return { ...migrationState }
}

/**
 * Get migration logs
 */
export function getMigrationLogs(since?: number): MigrationLog[] {
  if (since !== undefined && since < migrationLogs.length) {
    return migrationLogs.slice(since)
  }
  return [...migrationLogs]
}

/**
 * Add a migration log entry
 */
function addLog(type: MigrationLog["type"], message: string): void {
  migrationLogs.push({
    timestamp: new Date().toISOString(),
    type,
    message,
  })
  // Keep max 1000 log entries
  if (migrationLogs.length > 1000) {
    migrationLogs = migrationLogs.slice(-1000)
  }
}

/**
 * Abort migration
 */
export function abortMigration(): void {
  migrationAborted = true
  addLog("warning", "Migration abort requested by user")
}

/**
 * Start migration from local to S3
 * Runs asynchronously — call getMigrationProgress() to check status
 */
export async function startMigration(s3Config: S3Config): Promise<{ started: boolean; error?: string }> {
  // Check if migration is already running
  if (migrationState.status === "migrating") {
    return { started: false, error: "Migration is already in progress" }
  }

  // Reset state
  migrationAborted = false
  migrationLogs = []
  migrationState = {
    status: "migrating",
    totalFiles: 0,
    migratedFiles: 0,
    failedFiles: 0,
    totalSizeBytes: 0,
    migratedSizeBytes: 0,
    currentFile: "",
    startedAt: new Date().toISOString(),
    completedAt: null,
    error: null,
    speed: 0,
    estimatedTimeRemaining: 0,
  }

  // Save migration status
  await settingsManager.updateSetting(SETTING_KEYS.STORAGE_MIGRATION_STATUS, "migrating")

  // Run migration in background
  runMigration(s3Config).catch((error) => {
    console.error("Migration error:", error)
    migrationState.status = "failed"
    migrationState.error = error instanceof Error ? error.message : String(error)
    migrationState.completedAt = new Date().toISOString()
    addLog("error", `Migration failed: ${migrationState.error}`)
    settingsManager.updateSetting(SETTING_KEYS.STORAGE_MIGRATION_STATUS, "failed")
    settingsManager.updateSetting(
      SETTING_KEYS.STORAGE_MIGRATION_PROGRESS,
      JSON.stringify(migrationState)
    )
  })

  return { started: true }
}

/**
 * Internal migration logic
 */
async function runMigration(s3Config: S3Config): Promise<void> {
  const s3Provider = new S3StorageProvider(s3Config)

  addLog("info", "Starting migration from local storage to S3...")
  addLog("info", `S3 Endpoint: ${s3Config.endpoint}`)
  addLog("info", `S3 Bucket: ${s3Config.bucket}`)

  // Step 1: Test S3 connection first
  addLog("info", "Testing S3 connection...")
  const testResult = await s3Provider.testConnection()
  if (!testResult.success) {
    throw new Error(`S3 connection test failed: ${testResult.message}`)
  }
  addLog("success", "S3 connection verified successfully")

  // Step 2: Query all files that have local_file_path
  addLog("info", "Querying files to migrate...")
  const files = (await executeQuery(
    `SELECT id, device_id, file_path, file_name, local_file_path, file_size, file_type
     FROM files 
     WHERE local_file_path IS NOT NULL 
     ORDER BY id ASC`
  )) as Array<{
    id: number
    device_id: string
    file_path: string
    file_name: string
    local_file_path: string
    file_size: number
    file_type: string
  }>

  if (!files || files.length === 0) {
    addLog("info", "No files to migrate. Setting storage type to S3.")
    migrationState.status = "completed"
    migrationState.completedAt = new Date().toISOString()
    await settingsManager.updateSetting(SETTING_KEYS.STORAGE_TYPE, "s3")
    await settingsManager.updateSetting(SETTING_KEYS.STORAGE_MIGRATION_STATUS, "completed")
    resetStorageProvider()
    return
  }

  migrationState.totalFiles = files.length

  // Calculate total size
  let totalSize = 0
  for (const file of files) {
    totalSize += file.file_size || 0
  }
  migrationState.totalSizeBytes = totalSize

  addLog("info", `Found ${files.length} files to migrate (${formatBytes(totalSize)} total)`)

  // Step 3: Migrate files in batches
  const BATCH_SIZE = 10 // Concurrent uploads
  let migratedCount = 0
  let failedCount = 0
  let migratedSize = 0
  const startTime = Date.now()
  const failedFiles: Array<{ id: number; path: string; error: string }> = []

  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    // Check if abort was requested
    if (migrationAborted) {
      addLog("warning", "Migration aborted by user")
      migrationState.status = "failed"
      migrationState.error = "Migration aborted by user"
      migrationState.completedAt = new Date().toISOString()
      await settingsManager.updateSetting(SETTING_KEYS.STORAGE_MIGRATION_STATUS, "failed")
      await settingsManager.updateSetting(
        SETTING_KEYS.STORAGE_MIGRATION_PROGRESS,
        JSON.stringify(migrationState)
      )
      return
    }

    const batch = files.slice(i, i + BATCH_SIZE)

    const batchPromises = batch.map(async (file) => {
      try {
        migrationState.currentFile = file.local_file_path

        // Read from local filesystem
        const fullPath = path.join(process.cwd(), file.local_file_path)

        if (!existsSync(fullPath)) {
          addLog("warning", `File not found on disk, skipping: ${file.local_file_path}`)
          failedCount++
          failedFiles.push({
            id: file.id,
            path: file.local_file_path,
            error: "File not found on disk",
          })
          return
        }

        const fileData = await readFile(fullPath)

        // Upload to S3 using the same key as local_file_path
        await s3Provider.put(file.local_file_path, fileData)

        // Verify the upload
        const exists = await s3Provider.exists(file.local_file_path)
        if (!exists) {
          throw new Error("File upload verification failed — file not found in S3 after upload")
        }

        migratedCount++
        migratedSize += fileData.length

        // Update progress
        migrationState.migratedFiles = migratedCount
        migrationState.migratedSizeBytes = migratedSize

        const elapsed = (Date.now() - startTime) / 1000
        migrationState.speed = elapsed > 0 ? migratedSize / elapsed : 0
        const remainingSize = totalSize - migratedSize
        migrationState.estimatedTimeRemaining =
          migrationState.speed > 0 ? remainingSize / migrationState.speed : 0

      } catch (error) {
        failedCount++
        const errorMsg = error instanceof Error ? error.message : String(error)
        failedFiles.push({
          id: file.id,
          path: file.local_file_path,
          error: errorMsg,
        })
        addLog("error", `Failed to migrate ${file.local_file_path}: ${errorMsg}`)
      }
    })

    await Promise.allSettled(batchPromises)

    migrationState.failedFiles = failedCount

    // Persist progress periodically
    await settingsManager.updateSetting(
      SETTING_KEYS.STORAGE_MIGRATION_PROGRESS,
      JSON.stringify({
        migratedFiles: migratedCount,
        totalFiles: files.length,
        failedFiles: failedCount,
        migratedSizeBytes: migratedSize,
        totalSizeBytes: totalSize,
      })
    )

    // Log progress every batch
    const percent = ((migratedCount + failedCount) / files.length * 100).toFixed(1)
    addLog(
      "info",
      `Progress: ${percent}% (${migratedCount} migrated, ${failedCount} failed, ` +
      `${formatBytes(migratedSize)} / ${formatBytes(totalSize)})`
    )
  }

  // Step 4: Final status
  if (failedCount > 0) {
    addLog("warning", `Migration completed with ${failedCount} failed files out of ${files.length}`)
    addLog("warning", "Storage type NOT changed due to failures. Fix errors and retry.")

    migrationState.status = "failed"
    migrationState.error = `${failedCount} files failed to migrate`
    migrationState.completedAt = new Date().toISOString()

    await settingsManager.updateSetting(SETTING_KEYS.STORAGE_MIGRATION_STATUS, "failed")
  } else {
    addLog("success", `All ${files.length} files migrated successfully!`)
    addLog("info", `Total data migrated: ${formatBytes(migratedSize)}`)

    // Switch storage type to S3
    await settingsManager.updateSetting(SETTING_KEYS.STORAGE_TYPE, "s3")
    resetStorageProvider()

    migrationState.status = "completed"
    migrationState.completedAt = new Date().toISOString()

    await settingsManager.updateSetting(SETTING_KEYS.STORAGE_MIGRATION_STATUS, "completed")
    addLog("success", "Storage type switched to S3. All new files will be stored in object storage.")

    // Step 5: Clean up local files after successful migration
    addLog("info", "Cleaning up local files...")
    let cleanedCount = 0
    let cleanFailedCount = 0

    for (const file of files) {
      try {
        const fullPath = path.join(process.cwd(), file.local_file_path)
        if (existsSync(fullPath)) {
          await rm(fullPath, { force: true })
          cleanedCount++
        }
      } catch (cleanError) {
        cleanFailedCount++
        addLog("warning", `Failed to delete local file: ${file.local_file_path} — ${cleanError instanceof Error ? cleanError.message : String(cleanError)}`)
      }
    }

    addLog("info", `Local cleanup: ${cleanedCount} files deleted, ${cleanFailedCount} failed`)

    // Clean up empty directories under uploads/extracted_files/
    try {
      const extractedDir = path.join(process.cwd(), "uploads", "extracted_files")
      if (existsSync(extractedDir)) {
        await cleanEmptyDirs(extractedDir)
        addLog("info", "Empty directories cleaned up")
      }
    } catch (dirError) {
      addLog("warning", `Failed to clean empty directories: ${dirError instanceof Error ? dirError.message : String(dirError)}`)
    }
  }

  // Save final progress
  await settingsManager.updateSetting(
    SETTING_KEYS.STORAGE_MIGRATION_PROGRESS,
    JSON.stringify(migrationState)
  )
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

/**
 * Recursively remove empty directories
 */
async function cleanEmptyDirs(dirPath: string): Promise<boolean> {
  const entries = await readdir(dirPath, { withFileTypes: true })
  
  // Recursively clean subdirectories first
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subDir = path.join(dirPath, entry.name)
      await cleanEmptyDirs(subDir)
    }
  }

  // Re-check if directory is now empty
  const remaining = await readdir(dirPath)
  if (remaining.length === 0) {
    await rmdir(dirPath)
    return true
  }
  return false
}
