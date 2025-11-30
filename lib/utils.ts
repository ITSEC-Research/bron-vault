import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format bytes to human-readable string
 * @param bytes - Size in bytes
 * @param decimals - Number of decimal places
 * @returns Formatted string (e.g., "10.5 GB")
 */
export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 Bytes'
  
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]
}

/**
 * Parse human-readable size string to bytes
 * @param sizeStr - Size string (e.g., "10.5 GB")
 * @returns Size in bytes
 */
export function parseBytes(sizeStr: string): number {
  const units: { [key: string]: number } = {
    'bytes': 1,
    'kb': 1024,
    'mb': 1024 * 1024,
    'gb': 1024 * 1024 * 1024,
    'tb': 1024 * 1024 * 1024 * 1024
  }
  
  const match = sizeStr.toLowerCase().match(/^([\d.]+)\s*([a-z]+)$/)
  if (!match) throw new Error('Invalid size format')
  
  const value = parseFloat(match[1])
  const unit = match[2]
  const multiplier = units[unit] || 1
  
  return Math.floor(value * multiplier)
}

/**
 * Split array into chunks of specified size
 * @param array - Array to chunk
 * @param size - Size of each chunk
 * @returns Array of chunks
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  if (size <= 0) {
    throw new Error('Chunk size must be greater than 0')
  }
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size))
  }
  return chunks
}
