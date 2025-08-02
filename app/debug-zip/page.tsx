"use client";
export const dynamic = "force-dynamic";

import { useState, useRef } from "react"
import { FileArchive, AlertCircle, CheckCircle, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Progress } from "@/components/ui/progress"

interface ZipAnalysis {
  fileName: string
  fileSize: number
  totalEntries: number
  totalDirectories: number
  totalFiles: number
  uniqueDevices: number
  deviceDetails: Array<{
    deviceName: string
    totalFiles: number
    passwordFiles: number
    directories: number
    samplePaths: string[]
  }>
  issues: string[]
  sampleDeviceNames: string[]
}

export default function DebugZipPage() {
  const [analysis, setAnalysis] = useState<ZipAnalysis | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string>("")
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadStatus, setUploadStatus] = useState<{
    status: "idle" | "uploading" | "processing" | "success" | "error"
    progress: number
  }>({ status: "idle", progress: 0 })

  // Simulate upload progress (because debug is only local analysis, no upload to server)
  const simulateUpload = (file: File) => {
    setUploadStatus({ status: "uploading", progress: 0 })
    let progress = 0
    const interval = setInterval(() => {
      progress += 10
      setUploadStatus((prev) => ({ ...prev, progress }))
      if (progress >= 100) {
        clearInterval(interval)
        setUploadStatus({ status: "processing", progress: 0 })
        handleFileAnalysis(file)
      }
    }, 80)
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      simulateUpload(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      simulateUpload(e.target.files[0])
    }
  }

  const handleFileAnalysis = async (file: File) => {
    setUploadStatus({ status: "processing", progress: 0 })
    setIsLoading(true)
    setError("")
    setAnalysis(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/debug-large-zip", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const result = await response.json()
        setAnalysis(result.analysis)
        setUploadStatus({ status: "success", progress: 100 })
      } else {
        const errorData = await response.json()
        setError(errorData.error || "Analysis failed")
        setUploadStatus({ status: "error", progress: 0 })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error")
      setUploadStatus({ status: "error", progress: 0 })
    } finally {
      setIsLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
  }

  const resetDebug = () => {
    setUploadStatus({ status: "idle", progress: 0 })
    setAnalysis(null)
    setError("")
    setIsLoading(false)
  }

  return (
    <main className="flex-1 p-6 bg-bron-bg-primary">
      <div className="max-w-7xl mx-auto space-y-6">
        <Alert className="bg-bron-accent-yellow/10 border-bron-accent-yellow/30">
          <AlertCircle className="h-4 w-4 text-bron-accent-yellow" />
          <AlertDescription className="text-bron-text-primary">
            This tool analyzes ZIP file structure without uploading to database. Use this to debug issues with large
            ZIP files.
          </AlertDescription>
        </Alert>

        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardHeader>
            <CardTitle className="text-bron-text-primary">Analyze ZIP File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Dropzone only shows when idle */}
              {uploadStatus.status === "idle" && (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? "border-bron-accent-blue bg-bron-accent-blue/10"
                      : "border-bron-border hover:border-bron-accent-blue/50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                <FileArchive className="mx-auto h-12 w-12 text-bron-text-muted mb-4" />
                <div className="space-y-2">
                    <p className="text-lg font-medium text-bron-text-primary">Drop your .zip file here to analyze</p>
                    <p className="text-sm text-bron-text-muted">or click to browse</p>
                </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 bg-bron-accent-red hover:bg-bron-accent-red-hover text-white"
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Select File
                  </Button>
                <input
                    ref={fileInputRef}
                  type="file"
                  accept=".zip"
                    onChange={handleFileInput}
                    className="hidden"
                />
              </div>
              )}

              {/* Progress bar upload file (only when status is uploading) */}
              {uploadStatus.status === "uploading" && (
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Upload className="h-4 w-4 animate-pulse text-bron-accent-blue" />
                      <span className="text-bron-text-primary">Uploading file...</span>
                    </div>
                    <div className="text-sm font-medium text-bron-accent-blue">{uploadStatus.progress}%</div>
                  </div>
                  <Progress value={uploadStatus.progress} className="w-full" />
                </div>
              )}

              {/* Progress bar parsing/processing */}
              {uploadStatus.status === "processing" && (
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Upload className="h-4 w-4 animate-pulse text-bron-accent-blue" />
                      <span className="text-bron-text-primary">Processing data...</span>
                    </div>
                    <div className="text-sm font-medium text-bron-accent-blue">{uploadStatus.progress}%</div>
                  </div>
                  <Progress value={uploadStatus.progress} className="w-full" />
                </div>
              )}

              {isLoading && (
                <div className="text-center py-8">
                  <p className="text-bron-text-primary">Analyzing ZIP file structure...</p>
                </div>
              )}

              {error && (
                <Alert className="bg-bron-accent-red/10 border-bron-accent-red/30">
                  <AlertCircle className="h-4 w-4 text-bron-accent-red" />
                  <AlertDescription className="text-bron-text-primary">{error}</AlertDescription>
                </Alert>
              )}

              {analysis && (
                <div className="space-y-6">
                  <Alert className="bg-bron-accent-green/10 border-bron-accent-green/30">
                    <CheckCircle className="h-4 w-4 text-bron-accent-green" />
                    <AlertDescription className="text-bron-text-primary">
                      Analysis complete! Found {analysis.uniqueDevices} devices in {analysis.fileName}
                    </AlertDescription>
                  </Alert>

                  {/* File Overview */}
                  <Card className="bg-bron-bg-secondary border-bron-border">
                    <CardHeader>
                      <CardTitle className="text-bron-text-primary">File Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-2xl font-bold text-bron-accent-blue">
                            {formatFileSize(analysis.fileSize)}
                          </p>
                          <p className="text-sm text-bron-text-muted">File Size</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-bron-accent-green">
                            {analysis.totalEntries.toLocaleString()}
                          </p>
                          <p className="text-sm text-bron-text-muted">Total Entries</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-bron-text-primary">
                            {analysis.totalFiles.toLocaleString()}
                          </p>
                          <p className="text-sm text-bron-text-muted">Files</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-bron-accent-yellow">{analysis.uniqueDevices}</p>
                          <p className="text-sm text-bron-text-muted">Devices</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Issues */}
                  {analysis.issues.length > 0 && (
                    <Card className="bg-bron-bg-secondary border-bron-border">
                      <CardHeader>
                        <CardTitle className="text-bron-accent-red">Potential Issues</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analysis.issues.map((issue, index) => (
                            <Alert key={index} className="bg-bron-accent-red/10 border-bron-accent-red/30">
                              <AlertCircle className="h-4 w-4 text-bron-accent-red" />
                              <AlertDescription className="text-bron-text-primary">{issue}</AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Sample Device Names */}
                  <Card className="bg-bron-bg-secondary border-bron-border">
                    <CardHeader>
                      <CardTitle className="text-bron-text-primary">Sample Device Names</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {analysis.sampleDeviceNames.map((name, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="font-mono text-xs bg-bron-bg-tertiary text-bron-text-primary border-bron-border"
                          >
                            {name.length > 50 ? name.substring(0, 50) + "..." : name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Device Details */}
                  <Card className="bg-bron-bg-secondary border-bron-border">
                    <CardHeader>
                      <CardTitle className="text-bron-text-primary">Top 20 Devices by File Count</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96">
                        <div className="space-y-3">
                          {analysis.deviceDetails.map((device, index) => (
                            <div key={index} className="border border-bron-border rounded p-3 bg-bron-bg-tertiary">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-bron-text-primary">
                                  #{index + 1} {device.deviceName}
                                </h4>
                                <div className="flex space-x-2">
                                  <Badge className="bg-bron-accent-blue/20 text-bron-accent-blue border-bron-accent-blue/40">
                                    {device.totalFiles} files
                                  </Badge>
                                  <Badge
                                    className={
                                      device.passwordFiles > 0
                                        ? "bg-bron-accent-green/20 text-bron-accent-green border-bron-accent-green/40"
                                        : "bg-bron-accent-red/20 text-bron-accent-red border-bron-accent-red/40"
                                    }
                                  >
                                    {device.passwordFiles} passwords
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-sm text-bron-text-muted">
                                <p>Sample paths:</p>
                                <ul className="list-disc list-inside ml-2">
                                  {device.samplePaths.slice(0, 3).map((path, idx) => (
                                    <li key={idx} className="font-mono text-xs truncate">
                                      {path}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
              )}
              {(uploadStatus.status === "success" || uploadStatus.status === "error") && (
                <div className="mt-6 flex justify-center">
                  <Button
                    onClick={resetDebug}
                    variant="outline"
                    className="bg-bron-bg-secondary border-bron-border text-bron-text-primary hover:bg-bron-bg-tertiary"
                  >
                    Upload New Data
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
