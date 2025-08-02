// In-memory storage for demo purposes (until database is configured)
interface StoredFile {
  path: string
  name: string
  isDirectory: boolean
  content?: string // For text files
  size?: number
  parentPath: string
}

interface StoredDevice {
  deviceId: string
  deviceName: string
  uploadDate: Date
  uploadBatch: string // Add batch ID to distinguish uploads
  files: StoredFile[]
  hasMatchingContent: boolean
}

interface SearchMatch {
  deviceId: string
  deviceName: string
  uploadBatch: string
  matchingFiles: string[] // Files that contain the search term
  matchType: "email" | "domain"
  matchedContent: string[]
}

class MemoryStorage {
  private devices: Map<string, StoredDevice> = new Map()
  private uploadCounter = 0

  generateUploadBatch(): string {
    this.uploadCounter++
    return `batch_${Date.now()}_${this.uploadCounter}`
  }

  addDevice(deviceId: string, deviceName: string, uploadBatch: string, files: StoredFile[]) {
    // Always add device, even if name is duplicate
    this.devices.set(deviceId, {
      deviceId,
      deviceName,
      uploadDate: new Date(),
      uploadBatch,
      files,
      hasMatchingContent: false,
    })
  }

  searchByEmail(email: string): SearchMatch[] {
    const matches: SearchMatch[] = []

    for (const device of this.devices.values()) {
      const matchingFiles: string[] = []
      const matchedContent: string[] = []

      // Search through all text files in the device
      for (const file of device.files) {
        if (file.content && file.content.toLowerCase().includes(email.toLowerCase())) {
          matchingFiles.push(file.path)
          // Extract the line that contains the match
          const lines = file.content.split("\n")
          const matchingLines = lines.filter((line) => line.toLowerCase().includes(email.toLowerCase()))
          matchedContent.push(...matchingLines)
        }
      }

      if (matchingFiles.length > 0) {
        matches.push({
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          uploadBatch: device.uploadBatch,
          matchingFiles,
          matchType: "email",
          matchedContent,
        })
      }
    }

    return matches
  }

  searchByDomain(domain: string): SearchMatch[] {
    const matches: SearchMatch[] = []

    for (const device of this.devices.values()) {
      const matchingFiles: string[] = []
      const matchedContent: string[] = []

      // Search through all text files in the device
      for (const file of device.files) {
        if (file.content && file.content.toLowerCase().includes(domain.toLowerCase())) {
          matchingFiles.push(file.path)
          // Extract the line that contains the match
          const lines = file.content.split("\n")
          const matchingLines = lines.filter((line) => line.toLowerCase().includes(domain.toLowerCase()))
          matchedContent.push(...matchingLines)
        }
      }

      if (matchingFiles.length > 0) {
        matches.push({
          deviceId: device.deviceId,
          deviceName: device.deviceName,
          uploadBatch: device.uploadBatch,
          matchingFiles,
          matchType: "domain",
          matchedContent,
        })
      }
    }

    return matches
  }

  getDevice(deviceId: string): StoredDevice | undefined {
    return this.devices.get(deviceId)
  }

  getFileContent(deviceId: string, filePath: string): string | undefined {
    const device = this.devices.get(deviceId)
    if (!device) return undefined

    const file = device.files.find((f) => f.path === filePath)
    return file?.content
  }

  getAllDevices(): StoredDevice[] {
    return Array.from(this.devices.values())
  }

  // Get devices grouped by name to show duplicates
  getDevicesByName(): Map<string, StoredDevice[]> {
    const devicesByName = new Map<string, StoredDevice[]>()

    for (const device of this.devices.values()) {
      if (!devicesByName.has(device.deviceName)) {
        devicesByName.set(device.deviceName, [])
      }
      devicesByName.get(device.deviceName)!.push(device)
    }

    return devicesByName
  }

  clear() {
    this.devices.clear()
    this.uploadCounter = 0
  }

  getStats() {
    const totalFiles = Array.from(this.devices.values()).reduce((sum, device) => sum + device.files.length, 0)
    const devicesByName = this.getDevicesByName()
    const uniqueDeviceNames = devicesByName.size
    const duplicateDeviceNames = Array.from(devicesByName.values()).filter((devices) => devices.length > 1).length

    return {
      totalDevices: this.devices.size,
      uniqueDeviceNames,
      duplicateDeviceNames,
      totalFiles,
    }
  }
}

// Global instance for demo purposes
const memoryStorage = new MemoryStorage()

export { memoryStorage, type StoredDevice, type StoredFile, type SearchMatch }
