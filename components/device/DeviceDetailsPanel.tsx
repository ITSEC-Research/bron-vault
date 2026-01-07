"use client"

import React, { useState, useMemo } from "react"
import { X, User, File, Package, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CredentialsTable, CredentialsSearchBar } from "./CredentialsTable"
import { FileTreeViewer } from "../file/FileTreeViewer"
import { SoftwareTable, SoftwareSearchBar } from "./SoftwareTable"
import { DeviceSystemInfo } from "./DeviceSystemInfo"

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
  // System Information (optional - akan diambil dari database nanti)
  fileName?: string
  operatingSystem?: string
  ipAddress?: string
  username?: string
  hostname?: string
  country?: string
  filePath?: string
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
  onViewFullDetails?: (deviceId: string) => void
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
  onViewFullDetails: _onViewFullDetails,
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
      <SheetContent className="w-[60%] sm:max-w-none glass backdrop-blur-xl border-l border-white/5">
        <SheetHeader>
          <SheetTitle className="flex items-center justify-between text-foreground">
            <span>{selectedDevice.deviceName}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-foreground hover:bg-white/5"
            >
              <X className="h-4 w-4" />
            </Button>
          </SheetTitle>
        </SheetHeader>

        {/* System Information Section - Opsi 1: Di atas button "View Full Details" (Compact for 13" screens) */}
        <div className="mt-3 mb-3">
          <DeviceSystemInfo
            operatingSystem={selectedDevice.operatingSystem}
            ipAddress={selectedDevice.ipAddress}
            username={selectedDevice.username}
            hostname={selectedDevice.hostname}
            country={selectedDevice.country}
            filePath={selectedDevice.filePath}
          />
        </div>

        <div className="mt-4 mb-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // Open device details page in new tab
              const deviceDetailsUrl = `/device/${selectedDevice.deviceId}`
              window.open(deviceDetailsUrl, "_blank")
            }}
            className="w-full flex items-center justify-center space-x-2 glass-card border-primary/50 text-primary hover:border-primary hover:bg-primary/10 transition-all font-semibold"
          >
            <span>View Full Details</span>
            <ExternalLink className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-6">
          <Tabs defaultValue="credentials" className="w-full">
            <TabsList className="items-center justify-center rounded-md p-1 text-muted-foreground grid w-full grid-cols-3 glass-card h-8">
              <TabsTrigger
                value="credentials"
                className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
              >
                <User className="h-3 w-3 mr-1" />
                User Credentials
              </TabsTrigger>
              <TabsTrigger
                value="software"
                className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
              >
                <Package className="h-3 w-3 mr-1" />
                Software Installed
              </TabsTrigger>
              <TabsTrigger
                value="files"
                className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
              >
                <File className="h-3 w-3 mr-1" />
                Supporting Files
              </TabsTrigger>
            </TabsList>

            <TabsContent value="credentials" className="mt-4 mb-4">
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
            </TabsContent>

            <TabsContent value="software" className="mt-4 mb-4">
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
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <div className="h-[calc(100vh-170px)] overflow-y-auto overflow-x-hidden pb-32">
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
