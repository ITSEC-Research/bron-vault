"use client";
export const dynamic = "force-dynamic";

import { useState, useRef } from "react"
import { FileArchive, AlertCircle, CheckCircle, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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
    <main className="flex-1 p-6 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        <Alert className="glass-card border-primary/30">
          <AlertCircle className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            This tool analyzes ZIP file structure without uploading to database. Use this to debug issues with large
            ZIP files.
          </AlertDescription>
        </Alert>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-foreground">Analyze ZIP File</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Dropzone only shows when idle */}
              {uploadStatus.status === "idle" && (
                <div
                  className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragActive
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                <FileArchive className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <div className="space-y-2">
                    <p className="text-lg font-medium text-foreground">Drop your .zip file here to analyze</p>
                    <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
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
                      <Upload className="h-4 w-4 animate-pulse text-primary" />
                      <span className="text-foreground">Uploading file...</span>
                    </div>
                    <div className="text-sm font-medium text-primary">{uploadStatus.progress}%</div>
                  </div>
                  <Progress value={uploadStatus.progress} className="w-full" />
                </div>
              )}

              {/* Progress bar parsing/processing */}
              {uploadStatus.status === "processing" && (
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Upload className="h-4 w-4 animate-pulse text-primary" />
                      <span className="text-foreground">Processing data...</span>
                    </div>
                    <div className="text-sm font-medium text-primary">{uploadStatus.progress}%</div>
                  </div>
                  <Progress value={uploadStatus.progress} className="w-full" />
                </div>
              )}

              {isLoading && (
                <div className="text-center py-8">
                  <p className="text-foreground">Analyzing ZIP file structure...</p>
                </div>
              )}

              {error && (
                <Alert className="glass-card border-destructive/30">
                  <AlertCircle className="h-4 w-4 text-destructive" />
                  <AlertDescription className="text-foreground">{error}</AlertDescription>
                </Alert>
              )}

              {analysis && (
                <div className="space-y-6">
                  <Alert className="glass-card border-primary/30">
                    <CheckCircle className="h-4 w-4 text-primary" />
                    <AlertDescription className="text-foreground">
                      Analysis complete! Found {analysis.uniqueDevices} devices in {analysis.fileName}
                    </AlertDescription>
                  </Alert>

                  {/* File Overview */}
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-foreground">File Overview</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <p className="text-2xl font-bold text-primary">
                            {formatFileSize(analysis.fileSize)}
                          </p>
                          <p className="text-sm text-muted-foreground">File Size</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-primary">
                            {analysis.totalEntries.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">Total Entries</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-foreground">
                            {analysis.totalFiles.toLocaleString()}
                          </p>
                          <p className="text-sm text-muted-foreground">Files</p>
                        </div>
                        <div>
                          <p className="text-2xl font-bold text-primary">{analysis.uniqueDevices}</p>
                          <p className="text-sm text-muted-foreground">Devices</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Issues */}
                  {analysis.issues.length > 0 && (
                    <Card className="glass-card">
                      <CardHeader>
                        <CardTitle className="text-destructive">Potential Issues</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {analysis.issues.map((issue, index) => (
                            <Alert key={index} className="glass-card border-destructive/30">
                              <AlertCircle className="h-4 w-4 text-destructive" />
                              <AlertDescription className="text-foreground">{issue}</AlertDescription>
                            </Alert>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Sample Device Names */}
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-foreground">Sample Device Names</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {analysis.sampleDeviceNames.map((name, index) => (
                          <Badge
                            key={index}
                            variant="outline"
                            className="font-mono text-xs glass border-white/5"
                          >
                            {name.length > 50 ? name.substring(0, 50) + "..." : name}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Device Details */}
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-foreground">Top 20 Devices by File Count</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-96">
                        <div className="space-y-3">
                          {analysis.deviceDetails.map((device, index) => (
                            <div key={index} className="border border-border rounded p-3 glass">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="font-medium text-foreground">
                                  #{index + 1} {device.deviceName}
                                </h4>
                                <div className="flex space-x-2">
                                  <Badge className="glass border-primary/30 text-primary">
                                    {device.totalFiles} files
                                  </Badge>
                                  <Badge
                                    className={
                                      device.passwordFiles > 0
                                        ? "glass border-primary/30 text-primary"
                                        : "glass border-destructive/30 text-destructive"
                                    }
                                  >
                                    {device.passwordFiles} passwords
                                  </Badge>
                                </div>
                              </div>
                              <div className="text-sm text-muted-foreground">
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
                    className="glass-card border-border hover:border-primary/50"
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
