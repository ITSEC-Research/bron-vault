"use client"

import React from "react"
import { X, User, File } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { CredentialsTable } from "./CredentialsTable"
import { FileTreeViewer } from "../file/FileTreeViewer"

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
  onFileClick,
  onDownloadAllData,
}: DeviceDetailsPanelProps) {
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
            <TabsList className="grid w-full grid-cols-2 bg-bron-bg-tertiary border border-bron-border">
              <TabsTrigger
                value="credentials"
                className="flex items-center space-x-2 text-bron-text-secondary data-[state=active]:bg-bron-accent-red data-[state=active]:text-white"
              >
                <User className="h-4 w-4" />
                <span>User Credentials</span>
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
              <ScrollArea className="h-[calc(100vh-200px)]">
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
                />
              </ScrollArea>
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <ScrollArea className="h-[calc(100vh-200px)]">
                <FileTreeViewer
                  selectedDevice={selectedDevice}
                  onFileClick={onFileClick}
                  onDownloadAllData={onDownloadAllData}
                />
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  )
}
