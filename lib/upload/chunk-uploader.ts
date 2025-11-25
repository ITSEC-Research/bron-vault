/**
 * Chunk Uploader - Frontend utility for uploading large files in chunks
 * 
 * Features:
 * - Cancellation support via AbortController
 * - Fail-fast logic (stops all uploads if one chunk fails permanently)
 * - Resumability support (can resume existing uploads)
 * - Settings-based chunk size configuration
 */

export interface ChunkUploaderOptions {
  chunkSize?: number
  maxConcurrentChunks?: number
  retryAttempts?: number
  retryDelay?: number
  existingFileId?: string // Allow resuming an existing upload
  signal?: AbortSignal // For cancelling the upload
  onProgress?: (progress: number, uploaded: number, total: number) => void
  onChunkComplete?: (chunkIndex: number, totalChunks: number) => void
  onError?: (error: Error, chunkIndex?: number) => void
}

export interface ChunkUploadResult {
  fileId: string
  success: boolean
  error?: string
  aborted?: boolean
}

/**
 * Calculate optimal chunk size based on file size (fallback only)
 * This is only used if chunkSize is not provided in options
 * Settings should be used instead of this function
 */
export function calculateChunkSize(fileSize: number): number {
  if (fileSize < 100 * 1024 * 1024) return 5 * 1024 * 1024 // < 100MB: 5MB chunks
  if (fileSize < 1024 * 1024 * 1024) return 10 * 1024 * 1024 // < 1GB: 10MB chunks
  if (fileSize < 5 * 1024 * 1024 * 1024) return 25 * 1024 * 1024 // < 5GB: 25MB chunks
  return 50 * 1024 * 1024 // >= 5GB: 50MB chunks
}

/**
 * Upload file in chunks
 * 
 * Improved version with:
 * - AbortController support for cancellation
 * - Fail-fast logic (stops all uploads if one chunk fails permanently)
 * - Resumability support (checks for existing fileId)
 */
export async function uploadFileInChunks(
  file: File,
  sessionId: string,
  options: ChunkUploaderOptions = {}
): Promise<ChunkUploadResult> {
  const {
    chunkSize,
    maxConcurrentChunks = 3,
    retryAttempts = 3,
    retryDelay = 1000,
    existingFileId,
    signal,
    onProgress,
    onChunkComplete,
    onError,
  } = options

  // Use provided chunkSize, or calculate as fallback (should not happen if settings are loaded)
  const finalChunkSize = chunkSize || calculateChunkSize(file.size)
  
  if (!chunkSize) {
    console.warn("⚠️ No chunkSize provided in options, using calculated fallback. Settings should be loaded first.")
  }

  // Resumability: Use provided ID or generate one (Ideally, fetch this from server)
  const fileId = existingFileId || `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

  // Calculate total chunks using the chunkSize from settings
  const totalChunks = Math.ceil(file.size / finalChunkSize)

  console.log("🔧 Chunk Upload Configuration:", {
    fileId,
    fileName: file.name,
    fileSize: file.size,
    chunkSize: finalChunkSize,
    chunkSizeFromSettings: chunkSize ? "Yes" : "No (using fallback)",
    totalChunks,
    maxConcurrentChunks,
    retryAttempts,
    isResume: !!existingFileId,
    canCancel: !!signal,
  })

  // Track uploaded chunks
  const uploadedChunks = new Set<number>()
  // If resuming, we might want to populate uploadedChunks here by calling an API first
  
  let isAborted = false
  let fatalError: Error | null = null

  // Helper to check if we should stop
  const shouldStop = (): boolean => {
    return isAborted || fatalError !== null || (signal?.aborted ?? false)
  }

  /**
   * Upload a single chunk with retry logic
   */
  const uploadChunk = async (chunkIndex: number): Promise<boolean> => {
    if (shouldStop()) return false

    const start = chunkIndex * finalChunkSize
    const end = Math.min(start + finalChunkSize, file.size)
    const chunk = file.slice(start, end)

    console.log(`📤 Uploading chunk ${chunkIndex + 1}/${totalChunks} (${start}-${end} bytes, size: ${chunk.size} bytes)`)

    const formData = new FormData()
    formData.append("chunk", chunk)
    formData.append("chunkIndex", chunkIndex.toString())
    formData.append("totalChunks", totalChunks.toString())
    formData.append("fileId", fileId)
    formData.append("fileName", file.name)
    formData.append("fileSize", file.size.toString())
    formData.append("chunkSize", finalChunkSize.toString())
    formData.append("sessionId", sessionId)

    // Add validation hash/checksum here if needed for integrity
    let attempt = 0
    while (attempt < retryAttempts) {
      if (shouldStop()) return false

      try {
        const response = await fetch("/api/upload-chunk", {
          method: "POST",
          body: formData,
          signal: signal, // Pass abort signal to fetch
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `Upload failed with status ${response.status}`)
        }

        const result = await response.json()
        if (result.success) {
          uploadedChunks.add(chunkIndex)
          console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`)
          onChunkComplete?.(chunkIndex, totalChunks)
          return true
        } else {
          throw new Error(result.error || "Server error")
        }
      } catch (error: any) {
        // Don't retry if user aborted
        if (error.name === 'AbortError' || signal?.aborted) {
          isAborted = true
          return false
        }

        attempt++
        console.warn(`Chunk ${chunkIndex} failed (Attempt ${attempt}/${retryAttempts}):`, error)

        if (attempt >= retryAttempts) {
          // FAIL FAST: Set fatal error to stop other chunks
          const errorObj = error instanceof Error ? error : new Error(String(error))
          fatalError = errorObj
          onError?.(errorObj, chunkIndex)
          return false
        }

        // Wait with backoff before retry
        await new Promise((r) => setTimeout(r, retryDelay * attempt))
      }
    }

    return false
  }

  // Concurrency Manager
  const chunksToUpload = Array.from({ length: totalChunks }, (_, i) => i)
    .filter(i => !uploadedChunks.has(i))
  
  const activePromises = new Map<number, Promise<boolean>>()
  let chunkPointer = 0

  try {
    while ((chunkPointer < chunksToUpload.length || activePromises.size > 0) && !shouldStop()) {
      // Fill the pool
      while (
        activePromises.size < maxConcurrentChunks && 
        chunkPointer < chunksToUpload.length && 
        !shouldStop()
      ) {
        const chunkIndex = chunksToUpload[chunkPointer]
        chunkPointer++
        
        console.log(`🔄 Starting chunk ${chunkIndex + 1}/${totalChunks} (${activePromises.size + 1}/${maxConcurrentChunks} active)`)
        
        const promise = uploadChunk(chunkIndex).finally(() => {
          activePromises.delete(chunkIndex)
          // Update progress
          if (!shouldStop()) {
            const progress = (uploadedChunks.size / totalChunks) * 100
            onProgress?.(progress, uploadedChunks.size, totalChunks)
          }
        })
        
        activePromises.set(chunkIndex, promise)
      }

      // Wait for at least one to finish
      if (activePromises.size > 0) {
        await Promise.race(activePromises.values())
      }
    }

    // Wait for remaining active uploads to settle
    await Promise.allSettled(activePromises.values())
  } catch (err) {
    // Catch global errors inside the loop logic
    console.error("Critical upload loop error", err)
    return { fileId, success: false, error: "Internal upload error" }
  }

  // Final Result Handling
  if (signal?.aborted || isAborted) {
    return { fileId, success: false, aborted: true, error: "Upload cancelled by user" }
  }

  if (fatalError) {
    // TypeScript type narrowing: fatalError is guaranteed to be Error here
    const error: Error = fatalError
    return { fileId, success: false, error: `Upload failed: ${error.message}` }
  }

  if (uploadedChunks.size === totalChunks) {
    console.log("✅ All chunks uploaded successfully!")
    return { fileId, success: true }
  }

  console.error(`❌ Upload incomplete: ${totalChunks - uploadedChunks.size} chunk(s) failed`)
  return { fileId, success: false, error: "Incomplete upload" }
}

/**
 * Assemble chunks into file and process
 */
export async function assembleAndProcessFile(
  fileId: string,
  fileName: string,
  sessionId: string
): Promise<{ success: boolean; details?: any; error?: string }> {
  console.log(`🔧 Assembling file from chunks: ${fileId} (${fileName})`)
  try {
    const response = await fetch("/api/upload-assemble", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileId,
        fileName,
        sessionId,
      }),
    })

    const result = await response.json()

    if (result.success) {
      return {
        success: true,
        details: result.details,
      }
    } else {
      return {
        success: false,
        error: result.error || result.details || "Failed to assemble and process file",
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to assemble file",
    }
  }
}

/**
 * Get upload progress
 */
export async function getUploadProgress(fileId: string): Promise<{
  success: boolean
  progress?: number
  uploadedChunks?: number
  totalChunks?: number
  canResume?: boolean
  error?: string
}> {
  try {
    const response = await fetch(`/api/upload-chunk-status?fileId=${fileId}`)
    const result = await response.json()

    if (result.success) {
      return {
        success: true,
        progress: result.progress,
        uploadedChunks: result.uploadedChunks,
        totalChunks: result.totalChunks,
        canResume: result.canResume,
      }
    } else {
      return {
        success: false,
        error: result.error || "Failed to get upload progress",
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get upload progress",
    }
  }
}

