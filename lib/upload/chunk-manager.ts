import { existsSync } from "fs"
import { readdir, unlink, rmdir } from "fs/promises"
import path from "path"

export interface ChunkMetadata {
  fileId: string
  fileName: string
  fileSize: number
  totalChunks: number
  uploadedChunks: Set<number>
  sessionId: string
  createdAt: Date
  expiresAt: Date
}

/**
 * Chunk Manager - Manages chunk upload state and files
 * Uses in-memory storage for chunk metadata
 * Chunks are stored on disk: uploads/chunks/{fileId}/chunk_{index}.tmp
 */
class ChunkManager {
  private chunkMetadata: Map<string, ChunkMetadata> = new Map()
  private readonly CHUNK_EXPIRY_HOURS = 24
  private readonly chunksDir: string

  constructor() {
    this.chunksDir = path.join(process.cwd(), "uploads", "chunks")
  }

  /**
   * Initialize chunk metadata
   */
  initializeChunk(
    fileId: string,
    fileName: string,
    fileSize: number,
    totalChunks: number,
    sessionId: string
  ): ChunkMetadata {
    const metadata: ChunkMetadata = {
      fileId,
      fileName,
      fileSize,
      totalChunks,
      uploadedChunks: new Set(),
      sessionId,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + this.CHUNK_EXPIRY_HOURS * 60 * 60 * 1000),
    }

    this.chunkMetadata.set(fileId, metadata)
    return metadata
  }

  /**
   * Get chunk metadata
   */
  getChunkMetadata(fileId: string): ChunkMetadata | null {
    const metadata = this.chunkMetadata.get(fileId)
    if (!metadata) return null

    // Check if expired
    if (metadata.expiresAt < new Date()) {
      this.chunkMetadata.delete(fileId)
      return null
    }

    return metadata
  }

  /**
   * Mark chunk as uploaded
   */
  markChunkUploaded(fileId: string, chunkIndex: number): void {
    const metadata = this.chunkMetadata.get(fileId)
    if (metadata) {
      metadata.uploadedChunks.add(chunkIndex)
    }
  }

  /**
   * Get chunk file path
   */
  getChunkPath(fileId: string, chunkIndex: number): string {
    return path.join(this.chunksDir, fileId, `chunk_${chunkIndex}.tmp`)
  }

  /**
   * Get all chunk paths for a file
   */
  async getAllChunkPaths(fileId: string): Promise<string[]> {
    const chunkDir = path.join(this.chunksDir, fileId)
    if (!existsSync(chunkDir)) {
      return []
    }

    const files = await readdir(chunkDir)
    const chunkFiles = files
      .filter((f) => f.startsWith("chunk_") && f.endsWith(".tmp"))
      .map((f) => path.join(chunkDir, f))
      .sort((a, b) => {
        // Sort by chunk index
        const indexA = parseInt(path.basename(a).match(/\d+/)?.[0] || "0")
        const indexB = parseInt(path.basename(b).match(/\d+/)?.[0] || "0")
        return indexA - indexB
      })

    return chunkFiles
  }

  /**
   * Check if all chunks are uploaded
   */
  async areAllChunksUploaded(fileId: string): Promise<boolean> {
    const metadata = this.getChunkMetadata(fileId)
    if (!metadata) return false

    // Check if we have all chunk files on disk
    const chunkPaths = await this.getAllChunkPaths(fileId)
    return chunkPaths.length === metadata.totalChunks
  }

  /**
   * Get uploaded chunk indices
   */
  async getUploadedChunkIndices(fileId: string): Promise<number[]> {
    const chunkPaths = await this.getAllChunkPaths(fileId)
    return chunkPaths.map((chunkPath) => {
      const match = path.basename(chunkPath).match(/\d+/)
      return match ? parseInt(match[0]) : -1
    }).filter((idx) => idx >= 0)
  }

  /**
   * Clean up chunk files and metadata
   */
  async cleanupChunks(fileId: string): Promise<void> {
    const chunkDir = path.join(this.chunksDir, fileId)
    if (existsSync(chunkDir)) {
      try {
        const files = await readdir(chunkDir)
        for (const file of files) {
          await unlink(path.join(chunkDir, file))
        }
        await rmdir(chunkDir)
      } catch (error) {
        console.error(`Error cleaning up chunks for ${fileId}:`, error)
      }
    }

    this.chunkMetadata.delete(fileId)
  }

  /**
   * Clean up expired chunks
   */
  async cleanupExpiredChunks(): Promise<void> {
    const now = new Date()
    const expiredFileIds: string[] = []

    for (const [fileId, metadata] of this.chunkMetadata.entries()) {
      if (metadata.expiresAt < now) {
        expiredFileIds.push(fileId)
      }
    }

    for (const fileId of expiredFileIds) {
      await this.cleanupChunks(fileId)
    }
  }

  /**
   * Get chunk directory path
   */
  getChunkDir(fileId: string): string {
    return path.join(this.chunksDir, fileId)
  }
}

// Singleton instance
export const chunkManager = new ChunkManager()

