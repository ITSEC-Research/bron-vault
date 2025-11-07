"use client"

import React, { useState, useMemo } from "react"
import { X, User, File, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CredentialsTable, CredentialsSearchBar } from "./CredentialsTable"
import { FileTreeViewer } from "../file/FileTreeViewer"
import { SoftwareTable, SoftwareSearchBar } from "./SoftwareTable"

interface SearchResult {
  deviceId: string
  deviceName: string
  uploadBatch: string
  matchingFiles: string[]
  matchedContent: string[]
  files: any[]
  totalFiles: number
  upload_date?: string
  uploadDate?: string
}

interface Credential {
  browser: string
  url: string
  username: string
  password: string
  filePath?: string
}

interface Software {
  software_name: string
  version: string
  source_file: string
}

interface DeviceDetailsPanelProps {
  selectedDevice: SearchResult | null
  onClose: () => void
  deviceCredentials: Credential[]
  isLoadingCredentials: boolean
  credentialsError: string
  showPasswords: boolean
  setShowPasswords: (show: boolean) => void
  credentialsSearchQuery: string
  setCredentialsSearchQuery: (query: string) => void
  onRetryCredentials: () => void
  deviceSoftware: Software[]
  isLoadingSoftware: boolean
  softwareError: string
  softwareSearchQuery: string
  setSoftwareSearchQuery: (query: string) => void
  onRetrySoftware: () => void
  onFileClick: (deviceId: string, filePath: string, fileName: string, hasContent: boolean) => void
  onDownloadAllData: (deviceId: string, deviceName: string) => void
}

export function DeviceDetailsPanel({
  selectedDevice,
  onClose,
  deviceCredentials,
  isLoadingCredentials,
  credentialsError,
  showPasswords,
  setShowPasswords,
  credentialsSearchQuery,
  setCredentialsSearchQuery,
  onRetryCredentials,
  deviceSoftware,
  isLoadingSoftware,
  softwareError,
  softwareSearchQuery,
  setSoftwareSearchQuery,
  onRetrySoftware,
  onFileClick,
  onDownloadAllData,
}: DeviceDetailsPanelProps) {
  const [softwareDeduplicate, setSoftwareDeduplicate] = useState(false)

  // Calculate filtered credentials count for search bar
  const filteredCredentialsCount = useMemo(() => {
    if (!credentialsSearchQuery.trim()) return deviceCredentials.length
    const searchLower = credentialsSearchQuery.toLowerCase()
    return deviceCredentials.filter((credential) => {
      return (
        credential.username.toLowerCase().includes(searchLower) ||
        credential.url.toLowerCase().includes(searchLower) ||
        (credential.browser && credential.browser.toLowerCase().includes(searchLower))
      )
    }).length
  }, [deviceCredentials, credentialsSearchQuery])

  // Calculate filtered software count for search bar
  const filteredSoftwareCount = useMemo(() => {
    let filtered = deviceSoftware

    if (softwareSearchQuery.trim()) {
      const searchLower = softwareSearchQuery.toLowerCase()
      filtered = filtered.filter((sw) => 
        sw.software_name.toLowerCase().includes(searchLower) ||
        sw.version.toLowerCase().includes(searchLower)
      )
    }

    if (softwareDeduplicate) {
      const seen = new Set<string>()
      filtered = filtered.filter((sw) => {
        const key = `${sw.software_name}|${sw.version || 'N/A'}`
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
    }

    return filtered.length
  }, [deviceSoftware, softwareSearchQuery, softwareDeduplicate])

  if (!selectedDevice) return null

  return (
    <Sheet open={!!selectedDevice} onOpenChange={onClose}>
      <SheetContent className="w-[60%] sm:max-w-none bg-bron-bg-secondary border-l border-bron-border">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between text-bron-text-primary">
            <span>{selectedDevice.deviceName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-bron-text-primary hover:bg-bron-bg-tertiary"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6">
          <Tabs defaultValue="credentials" className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-bron-bg-tertiary border border-bron-border">
              <TabsTrigger
                value="credentials"
                className="flex items-center space-x-2 text-bron-text-secondary data-[state=active]:bg-bron-accent-red data-[state=active]:text-white"
              >
                <User className="h-4 w-4" />
                <span>User Credentials</span>
              </TabsTrigger>
              <TabsTrigger
                value="software"
                className="flex items-center space-x-2 text-bron-text-secondary data-[state=active]:bg-bron-accent-red data-[state=active]:text-white"
              >
                <Package className="h-4 w-4" />
                <span>Software Installed</span>
              </TabsTrigger>
              <TabsTrigger
                value="files"
                className="flex items-center space-x-2 text-bron-text-secondary data-[state=active]:bg-bron-accent-red data-[state=active]:text-white"
              >
                <File className="h-4 w-4" />
                <span>Supporting Files</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="credentials" className="mt-4">
              {!isLoadingCredentials && !credentialsError && deviceCredentials.length > 0 && (
                <CredentialsSearchBar
                  deviceCredentials={deviceCredentials}
                  credentialsSearchQuery={credentialsSearchQuery}
                  setCredentialsSearchQuery={setCredentialsSearchQuery}
                  showPasswords={showPasswords}
                  setShowPasswords={setShowPasswords}
                  filteredCount={filteredCredentialsCount}
                />
              )}
              <div className="h-[calc(100vh-250px)] overflow-auto">
                <CredentialsTable
                  deviceCredentials={deviceCredentials}
                  isLoadingCredentials={isLoadingCredentials}
                  credentialsError={credentialsError}
                  showPasswords={showPasswords}
                  setShowPasswords={setShowPasswords}
                  credentialsSearchQuery={credentialsSearchQuery}
                  setCredentialsSearchQuery={setCredentialsSearchQuery}
                  onRetryCredentials={onRetryCredentials}
                  deviceId={selectedDevice.deviceId}
                  hideSearchBar={true}
                />
              </div>
            </TabsContent>

            <TabsContent value="software" className="mt-4">
              {!isLoadingSoftware && !softwareError && deviceSoftware.length > 0 && (
                <SoftwareSearchBar
                  deviceSoftware={deviceSoftware}
                  softwareSearchQuery={softwareSearchQuery}
                  setSoftwareSearchQuery={setSoftwareSearchQuery}
                  deduplicate={softwareDeduplicate}
                  setDeduplicate={setSoftwareDeduplicate}
                  filteredCount={filteredSoftwareCount}
                />
              )}
              <div className="h-[calc(100vh-250px)] overflow-auto">
                <SoftwareTable
                  deviceSoftware={deviceSoftware}
                  isLoadingSoftware={isLoadingSoftware}
                  softwareError={softwareError}
                  softwareSearchQuery={softwareSearchQuery}
                  setSoftwareSearchQuery={setSoftwareSearchQuery}
                  onRetrySoftware={onRetrySoftware}
                  deviceId={selectedDevice.deviceId}
                  hideSearchBar={true}
                  deduplicate={softwareDeduplicate}
                />
              </div>
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <div className="h-[calc(100vh-170px)] overflow-auto">
                <FileTreeViewer
                  selectedDevice={selectedDevice}
                  onFileClick={onFileClick}
                  onDownloadAllData={onDownloadAllData}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
