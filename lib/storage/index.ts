/**
 * Storage Provider Abstraction Layer
 * 
 * Provides a unified interface for file storage operations,
 * supporting both local filesystem and S3-compatible object storage.
 */

import { settingsManager } from "@/lib/settings"
import { LocalStorageProvider } from "./local-storage"
import { S3StorageProvider } from "./s3-storage"

export type StorageType = "local" | "s3"

export interface StorageProvider {
  /**
   * Store a file
   * @param key - Storage key (relative path, e.g., "uploads/extracted_files/...")
   * @param data - File content as Buffer or string
   * @param contentType - MIME type (optional)
   */
  put(key: string, data: Buffer | string, contentType?: string): Promise<void>

  /**
   * Retrieve a file as Buffer
   * @param key - Storage key
   */
  get(key: string): Promise<Buffer>

  /**
   * Retrieve a file as a readable stream
   * @param key - Storage key
   */
  getStream(key: string): Promise<NodeJS.ReadableStream>

  /**
   * Check if a file exists
   * @param key - Storage key
   */
  exists(key: string): Promise<boolean>

  /**
   * Delete a file
   * @param key - Storage key
   */
  delete(key: string): Promise<void>

  /**
   * List files with a given prefix
   * @param prefix - Key prefix to list
   */
  list(prefix: string): Promise<string[]>

  /**
   * Get the storage type identifier
   */
  getType(): StorageType

  /**
   * Create directory structure (no-op for S3)
   * @param dirPath - Directory path relative key
   */
  ensureDir(dirPath: string): Promise<void>
}

export interface S3Config {
  endpoint: string
  region: string
  bucket: string
  accessKey: string
  secretKey: string
  pathStyle: boolean
  useSSL: boolean
}

// Singleton storage provider instance
let currentProvider: StorageProvider | null = null
let currentType: StorageType | null = null

/**
 * Get the active storage provider based on app settings.
 * Caches the provider and reuses it until settings change.
 */
export async function getStorageProvider(): Promise<StorageProvider> {
  const storageType = await settingsManager.getSettingString("storage_type", "local") as StorageType

  // Return cached provider if type hasn't changed
  if (currentProvider && currentType === storageType) {
    return currentProvider
  }

  if (storageType === "s3") {
    const [endpoint, region, bucket, accessKey, secretKey, pathStyleStr, useSSLStr] = await Promise.all([
      settingsManager.getSettingString("storage_s3_endpoint", ""),
      settingsManager.getSettingString("storage_s3_region", "us-east-1"),
      settingsManager.getSettingString("storage_s3_bucket", ""),
      settingsManager.getSettingString("storage_s3_access_key", ""),
      settingsManager.getSettingString("storage_s3_secret_key", ""),
      settingsManager.getSettingString("storage_s3_path_style", "true"),
      settingsManager.getSettingString("storage_s3_use_ssl", "true"),
    ])

    if (!endpoint || !bucket || !accessKey || !secretKey) {
      console.warn("S3 configuration incomplete, falling back to local storage")
      currentProvider = new LocalStorageProvider()
      currentType = "local"
      return currentProvider
    }

    const config: S3Config = {
      endpoint,
      region,
      bucket,
      accessKey,
      secretKey,
      pathStyle: pathStyleStr === "true" || pathStyleStr === "1",
      useSSL: useSSLStr === "true" || useSSLStr === "1",
    }

    currentProvider = new S3StorageProvider(config)
    currentType = "s3"
  } else {
    currentProvider = new LocalStorageProvider()
    currentType = "local"
  }

  return currentProvider
}

/**
 * Force refresh the storage provider (e.g., after settings change)
 */
export function resetStorageProvider(): void {
  currentProvider = null
  currentType = null
}

/**
 * Create a storage provider from explicit config (for testing connections)
 */
export function createS3Provider(config: S3Config): S3StorageProvider {
  return new S3StorageProvider(config)
}
