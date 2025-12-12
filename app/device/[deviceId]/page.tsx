"use client"

import React, { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, Server, User, Package, FileText, LayoutDashboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DeviceCredentialsTable } from "@/components/device/DeviceCredentialsTable"
import { DeviceSoftwareTable } from "@/components/device/DeviceSoftwareTable"
import { DeviceFileTreeViewer } from "@/components/device/DeviceFileTreeViewer"
import { DeviceMachineInfo } from "@/components/device/DeviceMachineInfo"
import { DeviceOverview } from "@/components/device/DeviceOverview"
import { FileContentDialog } from "@/components/file/FileContentDialog"

interface DeviceInfo {
  deviceId: string
  deviceName: string
  uploadBatch?: string
  uploadDate?: string
}

export default function DeviceDetailPage() {
  const params = useParams()
  const router = useRouter()
  const deviceId = params.deviceId as string

  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null)
  const [isLoadingDevice, setIsLoadingDevice] = useState(true)
  const [deviceError, setDeviceError] = useState<string>("")

  // File content dialog state
  const [selectedFile, setSelectedFile] = useState<{
    deviceId: string
    filePath: string
    fileName: string
  } | null>(null)
  const [fileContent, setFileContent] = useState<string>("")
  const [isLoadingFile, setIsLoadingFile] = useState(false)
  const [selectedFileType, setSelectedFileType] = useState<'text' | 'image' | null>(null)

  useEffect(() => {
    const loadDeviceInfo = async () => {
      if (!deviceId) return

      setIsLoadingDevice(true)
      setDeviceError("")

      try {
        const response = await fetch("/api/device-info", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ deviceId }),
        })

        if (response.ok) {
          const data = await response.json()
          setDeviceInfo(data)
        } else {
          const errorData = await response.json()
          setDeviceError(errorData.error || "Failed to load device info")
        }
      } catch (error) {
        console.error("Failed to load device info:", error)
        setDeviceError(`Network Error: ${error instanceof Error ? error.message : "Unknown error"}`)
      } finally {
        setIsLoadingDevice(false)
      }
    }

    loadDeviceInfo()
  }, [deviceId])

  // Handle file click
  const handleFileClick = async (deviceId: string, filePath: string, fileName: string, hasContent: boolean) => {
    if (!hasContent) return // Do nothing for files without content

    // Determine if file is viewable based on extension
    const fileExtension = fileName.toLowerCase().split(".").pop() || ""
    const viewableExtensions = [
      "txt",
      "log",
      "json",
      "xml",
      "html",
      "htm",
      "css",
      "js",
      "csv",
      "ini",
      "cfg",
      "conf",
      "md",
      "sql",
    ]
    const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp"]
    const isViewable =
      viewableExtensions.includes(fileExtension) ||
      fileName.toLowerCase().includes("password") ||
      !fileName.includes(".")
    const isImage = imageExtensions.includes(fileExtension)

    if (!isViewable && !isImage) return // Do nothing for non-viewable/non-image files

    setSelectedFile({ deviceId, filePath, fileName })
    setIsLoadingFile(true)
    setSelectedFileType(isImage ? 'image' : 'text')

    try {
      const response = await fetch("/api/file-content", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId, filePath }),
      })

      if (response.ok) {
        if (isImage) {
          const blob = await response.blob()
          // Only use URL.createObjectURL in browser environment
          if (typeof window !== 'undefined' && window.URL) {
            setFileContent(URL.createObjectURL(blob))
          } else {
            setFileContent("Image loading not supported in this environment")
          }
        } else {
          const data = await response.json()
          setFileContent(data.content)
        }
      } else {
        setFileContent("Error loading file content")
      }
    } catch (error) {
      setFileContent("Error loading file content")
    } finally {
      setIsLoadingFile(false)
    }
  }

  // Handle download all data
  const handleDownloadAllData = async (deviceId: string, deviceName: string) => {
    try {
      const response = await fetch("/api/download-device", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ deviceId }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${deviceName}_all_data.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        console.error("Failed to download device data")
      }
    } catch (error) {
      console.error("Error downloading device data:", error)
    }
  }

  if (isLoadingDevice) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <p className="text-xs text-foreground">Loading device information...</p>
      </div>
    )
  }

  if (deviceError || !deviceInfo) {
    return (
      <div className="min-h-screen bg-transparent flex items-center justify-center">
        <div className="text-center">
          <p className="text-xs text-foreground mb-4">{deviceError || "Device not found"}</p>
          <Button
            onClick={() => router.push("/")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-8 text-xs"
          >
            Back to Search
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-transparent">
      <div className="border-b border-white/5 bg-background/60 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/")}
                className="h-9 text-sm text-muted-foreground hover:text-foreground hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                Back to Search
              </Button>
              <div>
                <h1 className="text-base font-normal text-foreground">{deviceInfo.deviceName}</h1>
                <p className="text-xs text-muted-foreground mt-0.5">Device ID: {deviceInfo.deviceId}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-4">
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="items-center justify-center rounded-md p-1 text-muted-foreground grid w-full grid-cols-5 glass-card h-8">
            <TabsTrigger
              value="overview"
              className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <LayoutDashboard className="h-3 w-3 mr-1" />
              Overview
            </TabsTrigger>
            <TabsTrigger
              value="machine"
              className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <Server className="h-3 w-3 mr-1" />
              Host Information
            </TabsTrigger>
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
              <FileText className="h-3 w-3 mr-1" />
              Files
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <DeviceOverview deviceId={deviceId} />
          </TabsContent>

          <TabsContent value="machine" className="mt-4">
            <DeviceMachineInfo deviceId={deviceId} />
          </TabsContent>

          <TabsContent value="credentials" className="mt-4">
            <DeviceCredentialsTable deviceId={deviceId} />
          </TabsContent>

          <TabsContent value="software" className="mt-4">
            <DeviceSoftwareTable deviceId={deviceId} />
          </TabsContent>

          <TabsContent value="files" className="mt-4">
            <DeviceFileTreeViewer
              deviceId={deviceId}
              onFileClick={handleFileClick}
              onDownloadAllData={handleDownloadAllData}
            />
          </TabsContent>
        </Tabs>
      </div>

      {/* File Content Dialog */}
      <FileContentDialog
        selectedFile={selectedFile}
        onClose={() => {
          setSelectedFile(null)
          setFileContent("")
          setSelectedFileType(null)
        }}
        fileContent={fileContent}
        isLoadingFile={isLoadingFile}
        selectedFileType={selectedFileType}
        deviceName={deviceInfo?.deviceName}
      />
    </div>
  )
}

