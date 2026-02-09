/**
 * Local Filesystem Storage Provider
 * 
 * Implements StorageProvider interface using the local filesystem.
 * This is the default/existing storage behavior.
 */

import { writeFile, readFile, mkdir, readdir, unlink, stat, access } from "fs/promises"
import { createReadStream, existsSync } from "fs"
import path from "path"
import { Readable } from "stream"
import type { StorageProvider, StorageType } from "./index"

export class LocalStorageProvider implements StorageProvider {
  private readonly baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir || process.cwd()
  }

  getType(): StorageType {
    return "local"
  }

  /**
   * Store a file to local filesystem
   */
  async put(key: string, data: Buffer | string, _contentType?: string): Promise<void> {
    const fullPath = this.resolvePath(key)
    const dir = path.dirname(fullPath)

    // Ensure directory exists
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true })
    }

    if (typeof data === "string") {
      await writeFile(fullPath, data, "utf-8")
    } else {
      await writeFile(fullPath, data)
    }
  }

  /**
   * Read a file from local filesystem
   */
  async get(key: string): Promise<Buffer> {
    const fullPath = this.resolvePath(key)
    return await readFile(fullPath)
  }

  /**
   * Get a readable stream from local filesystem
   */
  async getStream(key: string): Promise<NodeJS.ReadableStream> {
    const fullPath = this.resolvePath(key)

    if (!existsSync(fullPath)) {
      throw new Error(`File not found: ${key}`)
    }

    return createReadStream(fullPath) as unknown as Readable
  }

  /**
   * Check if a file exists on local filesystem
   */
  async exists(key: string): Promise<boolean> {
    const fullPath = this.resolvePath(key)
    try {
      await access(fullPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Delete a file from local filesystem
   */
  async delete(key: string): Promise<void> {
    const fullPath = this.resolvePath(key)
    try {
      await unlink(fullPath)
    } catch (error: unknown) {
      // Ignore if file doesn't exist
      if (error instanceof Error && (error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
      }
    }
  }

  /**
   * List files under a prefix
   */
  async list(prefix: string): Promise<string[]> {
    const fullPath = this.resolvePath(prefix)
    const results: string[] = []

    try {
      await this.listRecursive(fullPath, prefix, results)
    } catch (error: unknown) {
      // Return empty if directory doesn't exist
      if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT") {
        return []
      }
      throw error
    }

    return results
  }

  /**
   * Ensure a directory exists
   */
  async ensureDir(dirPath: string): Promise<void> {
    const fullPath = this.resolvePath(dirPath)
    if (!existsSync(fullPath)) {
      await mkdir(fullPath, { recursive: true })
    }
  }

  /**
   * Resolve a storage key to a full filesystem path
   */
  private resolvePath(key: string): string {
    // If key is already absolute, use it directly (backward compat)
    if (path.isAbsolute(key)) {
      return key
    }
    return path.join(this.baseDir, key)
  }

  /**
   * Recursively list files in a directory
   */
  private async listRecursive(dir: string, prefix: string, results: string[]): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const entryPath = path.join(dir, entry.name)
      const relPath = path.join(prefix, entry.name)

      if (entry.isDirectory()) {
        await this.listRecursive(entryPath, relPath, results)
      } else {
        results.push(relPath)
      }
    }
  }

  /**
   * Get file stats (used internally for migration)
   */
  async getStats(key: string): Promise<{ size: number }> {
    const fullPath = this.resolvePath(key)
    const stats = await stat(fullPath)
    return { size: stats.size }
  }
}
