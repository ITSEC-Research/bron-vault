import { executeQuery, ensureAppSettingsTable } from "@/lib/mysql"

export interface AppSetting {
  id: number
  key_name: string
  value: string
  description?: string
  created_at: Date
  updated_at: Date
}

// Type-safe setting keys
export const SETTING_KEYS = {
  // Upload settings
  UPLOAD_MAX_FILE_SIZE: 'upload_max_file_size',
  UPLOAD_CHUNK_SIZE: 'upload_chunk_size',
  UPLOAD_MAX_CONCURRENT_CHUNKS: 'upload_max_concurrent_chunks',
  UPLOAD_API_CONCURRENCY: 'upload_api_concurrency',
  UPLOAD_TEMP_CLEANUP_HOURS: 'upload_temp_cleanup_hours',
  UPLOAD_API_MAX_DURATION_SECONDS: 'upload_api_max_duration_seconds',
  // Database batch size settings
  DB_BATCH_SIZE_CREDENTIALS: 'db_batch_size_credentials',
  DB_BATCH_SIZE_PASSWORD_STATS: 'db_batch_size_password_stats',
  DB_BATCH_SIZE_FILES: 'db_batch_size_files',
  FILE_WRITE_PARALLEL_LIMIT: 'file_write_parallel_limit',
  // Storage settings
  STORAGE_TYPE: 'storage_type',
  S3_ENDPOINT: 'storage_s3_endpoint',
  S3_REGION: 'storage_s3_region',
  S3_BUCKET: 'storage_s3_bucket',
  S3_ACCESS_KEY: 'storage_s3_access_key',
  S3_SECRET_KEY: 'storage_s3_secret_key',
  S3_PATH_STYLE: 'storage_s3_path_style',
  S3_USE_SSL: 'storage_s3_use_ssl',
  STORAGE_MIGRATION_STATUS: 'storage_migration_status',
  STORAGE_MIGRATION_PROGRESS: 'storage_migration_progress',
} as const

export type SettingKey = typeof SETTING_KEYS[keyof typeof SETTING_KEYS]

export interface UploadSettings {
  maxFileSize: number
  chunkSize: number
  maxConcurrentChunks: number
  apiConcurrency: number
  tempCleanupHours: number
  apiMaxDurationSeconds: number
}

export interface BatchSettings {
  credentialsBatchSize: number
  passwordStatsBatchSize: number
  filesBatchSize: number
  fileWriteParallelLimit: number
}

class SettingsManager {
  private cache: Map<string, AppSetting> = new Map()
  private cacheExpiry: Map<string, number> = new Map()
  private readonly CACHE_TTL = 60000 // 1 minute
  private tableEnsured = false

  /**
   * Ensure app_settings table exists before any operation
   */
  private async ensureTable() {
    if (!this.tableEnsured) {
      try {
        await ensureAppSettingsTable()
        this.tableEnsured = true
      } catch (error) {
        console.error("Failed to ensure app_settings table:", error)
        // Continue anyway - might be a temporary issue
      }
    }
  }

  /**
   * Get setting value with type casting
   */
  async getSetting<T>(keyName: string, defaultValue?: T): Promise<T> {
    const setting = await this.getSettingRecord(keyName)
    if (!setting) {
      if (defaultValue !== undefined) {
        return defaultValue
      }
      throw new Error(`Setting '${keyName}' not found`)
    }

    // Try to infer type from value
    const value = setting.value.trim()
    
    // Try number
    if (!isNaN(Number(value)) && value !== '') {
      return Number(value) as T
    }
    
    // Try boolean
    if (value === 'true' || value === '1') {
      return true as T
    }
    if (value === 'false' || value === '0') {
      return false as T
    }
    
    // Try JSON
    if (value.startsWith('{') || value.startsWith('[')) {
      try {
        return JSON.parse(value) as T
      } catch {
        // Not valid JSON, return as string
      }
    }
    
    // Return as string
    return value as T
  }

  /**
   * Get setting as string
   */
  async getSettingString(keyName: string, defaultValue?: string): Promise<string> {
    const value = await this.getSetting<string>(keyName, defaultValue)
    return String(value)
  }

  /**
   * Get setting as number
   */
  async getSettingNumber(keyName: string, defaultValue?: number): Promise<number> {
    const value = await this.getSetting<number>(keyName, defaultValue)
    const num = Number(value)
    if (isNaN(num)) {
      if (defaultValue !== undefined) return defaultValue
      throw new Error(`Setting '${keyName}' is not a valid number`)
    }
    return num
  }

  /**
   * Get setting as boolean
   */
  async getSettingBoolean(keyName: string, defaultValue?: boolean): Promise<boolean> {
    const value = await this.getSetting<string>(keyName)
    if (value === 'true' || value === '1') return true
    if (value === 'false' || value === '0') return false
    if (defaultValue !== undefined) return defaultValue
    throw new Error(`Setting '${keyName}' is not a valid boolean`)
  }

  /**
   * Get setting as JSON object
   */
  async getSettingJSON<T>(keyName: string, defaultValue?: T): Promise<T> {
    const value = await this.getSetting<string>(keyName)
    try {
      return JSON.parse(value) as T
    } catch {
      if (defaultValue !== undefined) return defaultValue
      throw new Error(`Setting '${keyName}' is not valid JSON`)
    }
  }

  /**
   * Get setting record from database
   */
  private async getSettingRecord(keyName: string): Promise<AppSetting | null> {
    // Ensure table exists
    await this.ensureTable()

    // Check cache
    const cached = this.cache.get(keyName)
    const expiry = this.cacheExpiry.get(keyName)
    if (cached && expiry && Date.now() < expiry) {
      return cached
    }

    try {
      const result = (await executeQuery(
        'SELECT * FROM app_settings WHERE key_name = ? LIMIT 1',
        [keyName]
      )) as AppSetting[]

      if (result.length === 0) {
        return null
      }

      const setting = result[0]
      
      // Update cache
      this.cache.set(keyName, setting)
      this.cacheExpiry.set(keyName, Date.now() + this.CACHE_TTL)
      
      return setting
    } catch (error) {
      console.error(`Error getting setting '${keyName}':`, error)
      return null
    }
  }

  /**
   * Update setting
   */
  async updateSetting(
    keyName: string,
    value: string | number | boolean | object
  ): Promise<void> {
    // Ensure table exists
    await this.ensureTable()

    // Convert value to string
    let stringValue: string
    if (typeof value === 'object') {
      stringValue = JSON.stringify(value)
    } else {
      stringValue = String(value)
    }

    try {
      await executeQuery(
        `INSERT INTO app_settings (key_name, value) 
         VALUES (?, ?) 
         ON DUPLICATE KEY UPDATE value = ?, updated_at = CURRENT_TIMESTAMP`,
        [keyName, stringValue, stringValue]
      )

      // Invalidate cache
      this.cache.delete(keyName)
      this.cacheExpiry.delete(keyName)
    } catch (error) {
      console.error(`Error updating setting '${keyName}':`, error)
      throw error
    }
  }

  /**
   * Get all settings
   */
  async getAllSettings(): Promise<AppSetting[]> {
    // Ensure table exists
    await this.ensureTable()

    try {
      const result = (await executeQuery(
        'SELECT * FROM app_settings ORDER BY key_name'
      )) as AppSetting[]
      return result
    } catch (error) {
      console.error('Error getting all settings:', error)
      return []
    }
  }

  /**
   * Get settings by prefix
   */
  async getSettingsByPrefix(prefix: string): Promise<AppSetting[]> {
    // Ensure table exists
    await this.ensureTable()

    try {
      const result = (await executeQuery(
        'SELECT * FROM app_settings WHERE key_name LIKE ? ORDER BY key_name',
        [`${prefix}%`]
      )) as AppSetting[]
      return result
    } catch (error) {
      console.error(`Error getting settings with prefix '${prefix}':`, error)
      return []
    }
  }

  /**
   * Get upload-specific settings (convenience method)
   */
  async getUploadSettings(): Promise<UploadSettings> {
    const [
      maxFileSize,
      chunkSize,
      maxConcurrentChunks,
      apiConcurrency,
      tempCleanupHours,
      apiMaxDurationSeconds,
    ] = await Promise.all([
      this.getSettingNumber(SETTING_KEYS.UPLOAD_MAX_FILE_SIZE, 10737418240), // 10GB default
      this.getSettingNumber(SETTING_KEYS.UPLOAD_CHUNK_SIZE, 10485760), // 10MB default
      this.getSettingNumber(SETTING_KEYS.UPLOAD_MAX_CONCURRENT_CHUNKS, 3), // 3 default
      this.getSettingNumber(SETTING_KEYS.UPLOAD_API_CONCURRENCY, 2), // recommended: 2
      this.getSettingNumber(SETTING_KEYS.UPLOAD_TEMP_CLEANUP_HOURS, 24), // recommended: 24
      this.getSettingNumber(SETTING_KEYS.UPLOAD_API_MAX_DURATION_SECONDS, 300), // recommended: 300
    ])

    return {
      maxFileSize,
      chunkSize,
      maxConcurrentChunks,
      apiConcurrency,
      tempCleanupHours,
      apiMaxDurationSeconds,
    }
  }

  /**
   * Get batch size settings for database operations (convenience method)
   */
  async getBatchSettings(): Promise<BatchSettings> {
    const [credentialsBatchSize, passwordStatsBatchSize, filesBatchSize, fileWriteParallelLimit] = await Promise.all([
      this.getSettingNumber(SETTING_KEYS.DB_BATCH_SIZE_CREDENTIALS, 1000), // 1000 default
      this.getSettingNumber(SETTING_KEYS.DB_BATCH_SIZE_PASSWORD_STATS, 500), // 500 default
      this.getSettingNumber(SETTING_KEYS.DB_BATCH_SIZE_FILES, 500), // 500 default
      this.getSettingNumber(SETTING_KEYS.FILE_WRITE_PARALLEL_LIMIT, 10), // 10 default
    ])

    return {
      credentialsBatchSize,
      passwordStatsBatchSize,
      filesBatchSize,
      fileWriteParallelLimit,
    }
  }

  /**
   * Get storage settings (convenience method)
   */
  async getStorageSettings(): Promise<{
    storageType: string
    s3Endpoint: string
    s3Region: string
    s3Bucket: string
    s3AccessKey: string
    s3SecretKey: string
    s3PathStyle: boolean
    s3UseSSL: boolean
    migrationStatus: string
    migrationProgress: string
  }> {
    const [
      storageType, s3Endpoint, s3Region, s3Bucket,
      s3AccessKey, s3SecretKey, s3PathStyle, s3UseSSL,
      migrationStatus, migrationProgress,
    ] = await Promise.all([
      this.getSettingString(SETTING_KEYS.STORAGE_TYPE, 'local'),
      this.getSettingString(SETTING_KEYS.S3_ENDPOINT, ''),
      this.getSettingString(SETTING_KEYS.S3_REGION, 'us-east-1'),
      this.getSettingString(SETTING_KEYS.S3_BUCKET, ''),
      this.getSettingString(SETTING_KEYS.S3_ACCESS_KEY, ''),
      this.getSettingString(SETTING_KEYS.S3_SECRET_KEY, ''),
      this.getSettingString(SETTING_KEYS.S3_PATH_STYLE, 'true'),
      this.getSettingString(SETTING_KEYS.S3_USE_SSL, 'true'),
      this.getSettingString(SETTING_KEYS.STORAGE_MIGRATION_STATUS, 'idle'),
      this.getSettingString(SETTING_KEYS.STORAGE_MIGRATION_PROGRESS, '{}'),
    ])

    return {
      storageType,
      s3Endpoint,
      s3Region,
      s3Bucket,
      s3AccessKey,
      s3SecretKey,
      s3PathStyle: s3PathStyle === 'true' || s3PathStyle === '1',
      s3UseSSL: s3UseSSL === 'true' || s3UseSSL === '1',
      migrationStatus,
      migrationProgress,
    }
  }

  /**
   * Check if setting exists
   */
  async settingExists(keyName: string): Promise<boolean> {
    const setting = await this.getSettingRecord(keyName)
    return setting !== null
  }

  /**
   * Delete setting
   */
  async deleteSetting(keyName: string): Promise<void> {
    // Ensure table exists
    await this.ensureTable()

    try {
      await executeQuery('DELETE FROM app_settings WHERE key_name = ?', [keyName])
      
      // Invalidate cache
      this.cache.delete(keyName)
      this.cacheExpiry.delete(keyName)
    } catch (error) {
      console.error(`Error deleting setting '${keyName}':`, error)
      throw error
    }
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear()
    this.cacheExpiry.clear()
  }
}

// Singleton instance
export const settingsManager = new SettingsManager()

