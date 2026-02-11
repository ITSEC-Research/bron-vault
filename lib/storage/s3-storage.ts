/**
 * S3-Compatible Object Storage Provider
 * 
 * Implements StorageProvider interface using AWS S3 SDK.
 * Compatible with AWS S3, MinIO, and any S3-compatible storage.
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
  CreateBucketCommand,
  HeadBucketCommand,
} from "@aws-sdk/client-s3"
import { Upload } from "@aws-sdk/lib-storage"
import { Readable } from "stream"
import type { StorageProvider, StorageType, S3Config } from "./index"

export class S3StorageProvider implements StorageProvider {
  private client: S3Client
  private bucket: string
  private config: S3Config

  constructor(config: S3Config) {
    this.config = config
    this.bucket = config.bucket

    // Build endpoint URL with proper protocol
    let endpoint = config.endpoint
    if (endpoint && !endpoint.startsWith("http://") && !endpoint.startsWith("https://")) {
      endpoint = (config.useSSL ? "https://" : "http://") + endpoint
    }

    this.client = new S3Client({
      endpoint,
      region: config.region || "us-east-1",
      credentials: {
        accessKeyId: config.accessKey,
        secretAccessKey: config.secretKey,
      },
      forcePathStyle: config.pathStyle, // Required for MinIO
    })
  }

  getType(): StorageType {
    return "s3"
  }

  /**
   * Store a file in S3
   */
  async put(key: string, data: Buffer | string, contentType?: string): Promise<void> {
    const body = typeof data === "string" ? Buffer.from(data, "utf-8") : data

    // Use Upload for files larger than 5MB (multipart upload)
    if (body.length > 5 * 1024 * 1024) {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: this.bucket,
          Key: this.normalizeKey(key),
          Body: body,
          ContentType: contentType || this.guessContentType(key),
        },
        queueSize: 4,
        partSize: 5 * 1024 * 1024,
      })

      await upload.done()
    } else {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.normalizeKey(key),
          Body: body,
          ContentType: contentType || this.guessContentType(key),
        })
      )
    }
  }

  /**
   * Retrieve a file from S3 as Buffer
   */
  async get(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.normalizeKey(key),
      })
    )

    if (!response.Body) {
      throw new Error(`Empty response for key: ${key}`)
    }

    // Convert stream to Buffer
    const stream = response.Body as Readable
    const chunks: Buffer[] = []

    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    }

    return Buffer.concat(chunks)
  }

  /**
   * Retrieve a file from S3 as a readable stream
   */
  async getStream(key: string): Promise<NodeJS.ReadableStream> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.normalizeKey(key),
      })
    )

    if (!response.Body) {
      throw new Error(`Empty response for key: ${key}`)
    }

    return response.Body as NodeJS.ReadableStream
  }

  /**
   * Check if a file exists in S3
   */
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.normalizeKey(key),
        })
      )
      return true
    } catch (error: unknown) {
      const err = error as { name?: string; $metadata?: { httpStatusCode?: number } }
      if (err.name === "NotFound" || err.$metadata?.httpStatusCode === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * Delete a file from S3
   */
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.normalizeKey(key),
      })
    )
  }

  /**
   * List files with a given prefix in S3
   */
  async list(prefix: string): Promise<string[]> {
    const results: string[] = []
    let continuationToken: string | undefined

    do {
      const response = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.normalizeKey(prefix),
          ContinuationToken: continuationToken,
          MaxKeys: 1000,
        })
      )

      if (response.Contents) {
        for (const obj of response.Contents) {
          if (obj.Key) {
            results.push(obj.Key)
          }
        }
      }

      continuationToken = response.NextContinuationToken
    } while (continuationToken)

    return results
  }

  /**
   * Ensure directory — no-op for S3 (S3 doesn't have real directories)
   */
  async ensureDir(_dirPath: string): Promise<void> {
    // No-op: S3 uses flat key structure
  }

  /**
   * Test the S3 connection by verifying bucket access and performing read/write/delete test
   */
  async testConnection(): Promise<{
    success: boolean
    message: string
    details?: {
      bucketExists: boolean
      canWrite: boolean
      canRead: boolean
      canDelete: boolean
      endpoint: string
      bucket: string
    }
  }> {
    const details = {
      bucketExists: false,
      canWrite: false,
      canRead: false,
      canDelete: false,
      endpoint: this.config.endpoint,
      bucket: this.bucket,
    }

    try {
      // 1. Check if bucket exists
      try {
        await this.client.send(
          new HeadBucketCommand({ Bucket: this.bucket })
        )
        details.bucketExists = true
      } catch (error: unknown) {
        const err = error as { name?: string; $metadata?: { httpStatusCode?: number } }
        if (err.$metadata?.httpStatusCode === 404 || err.name === "NotFound") {
          // Try to create the bucket
          try {
            await this.client.send(
              new CreateBucketCommand({ Bucket: this.bucket })
            )
            details.bucketExists = true
          } catch (createError) {
            return {
              success: false,
              message: `Bucket "${this.bucket}" does not exist and could not be created: ${createError instanceof Error ? createError.message : String(createError)}`,
              details,
            }
          }
        } else if (err.$metadata?.httpStatusCode === 403) {
          return {
            success: false,
            message: `Access denied to bucket "${this.bucket}". Check your credentials and permissions.`,
            details,
          }
        } else {
          const errMsg = error instanceof Error ? error.message : String(error)
          const errName = err.name || "Unknown"
          const errCode = err.$metadata?.httpStatusCode || "N/A"
          return {
            success: false,
            message: `Cannot connect to S3 endpoint: ${errName} (HTTP ${errCode}). ${errMsg}. Make sure the endpoint URL and port are correct (e.g., for MinIO use the S3 API port, not the console port).`,
            details,
          }
        }
      }

      // 2. Test write
      const testKey = ".bron-vault-connection-test"
      const testData = `Connection test at ${new Date().toISOString()}`
      try {
        await this.client.send(
          new PutObjectCommand({
            Bucket: this.bucket,
            Key: testKey,
            Body: testData,
            ContentType: "text/plain",
          })
        )
        details.canWrite = true
      } catch (error) {
        return {
          success: false,
          message: `Cannot write to bucket: ${error instanceof Error ? error.message : String(error)}`,
          details,
        }
      }

      // 3. Test read
      try {
        const response = await this.client.send(
          new GetObjectCommand({
            Bucket: this.bucket,
            Key: testKey,
          })
        )
        if (response.Body) {
          const stream = response.Body as Readable
          const chunks: Buffer[] = []
          for await (const chunk of stream) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
          }
          const content = Buffer.concat(chunks).toString("utf-8")
          details.canRead = content === testData
        }
      } catch (error) {
        return {
          success: false,
          message: `Cannot read from bucket: ${error instanceof Error ? error.message : String(error)}`,
          details,
        }
      }

      // 4. Test delete
      try {
        await this.client.send(
          new DeleteObjectCommand({
            Bucket: this.bucket,
            Key: testKey,
          })
        )
        details.canDelete = true
      } catch (error) {
        return {
          success: false,
          message: `Cannot delete from bucket: ${error instanceof Error ? error.message : String(error)}`,
          details,
        }
      }

      return {
        success: true,
        message: "Connection successful! All operations (read, write, delete) verified.",
        details,
      }
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
        details,
      }
    }
  }

  /**
   * Normalize storage key — strip leading slashes and "uploads/" prefix normalization
   */
  private normalizeKey(key: string): string {
    // Remove leading slash
    let normalized = key.replace(/^\/+/, "")
    // Normalize double slashes
    normalized = normalized.replace(/\/+/g, "/")
    return normalized
  }

  /**
   * Guess content type from file extension
   */
  private guessContentType(key: string): string {
    const ext = key.split(".").pop()?.toLowerCase()
    const mimeTypes: Record<string, string> = {
      txt: "text/plain",
      log: "text/plain",
      json: "application/json",
      xml: "application/xml",
      html: "text/html",
      htm: "text/html",
      css: "text/css",
      js: "application/javascript",
      csv: "text/csv",
      ini: "text/plain",
      cfg: "text/plain",
      conf: "text/plain",
      md: "text/markdown",
      sql: "text/plain",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      bmp: "image/bmp",
      webp: "image/webp",
      svg: "image/svg+xml",
      pdf: "application/pdf",
      zip: "application/zip",
      gz: "application/gzip",
    }

    return mimeTypes[ext || ""] || "application/octet-stream"
  }
}
