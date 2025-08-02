"use client";
export const dynamic = "force-dynamic";

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Upload, FileArchive, CheckCircle, AlertCircle, Info, SkipForward, HardDrive, Monitor } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

interface UploadStatus {
  status: "idle" | "uploading" | "processing" | "success" | "error"
  message: string
  progress: number
  details?: {
    devicesFound: number
    devicesProcessed: number
    devicesSkipped: number
    totalFiles: number
    totalCredentials: number
    totalDomains: number
    totalUrls: number
    totalBinaryFiles: number
    uploadBatch: string
    processedDevices: string[]
    skippedDevices: string[]
  }
  errorDetails?: string
}

interface LogEntry {
  timestamp: string
  message: string
  type: "info" | "success" | "warning" | "error"
}

export default function UploadPage() {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: "idle",
    message: "",
    progress: 0,
  })
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add new state:
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [logSessionId, setLogSessionId] = useState<string>("")
  // Ref untuk auto scroll log (pada ScrollArea)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto scroll ke bawah setiap logs berubah
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [logs])

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
      handleFile(e.dataTransfer.files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    console.log("🔍 handleFileInput called")
    if (e.target.files && e.target.files[0]) {
      console.log("📁 File selected:", e.target.files[0].name)
      handleFile(e.target.files[0])
    } else {
      console.log("❌ No file selected")
    }
  }

  const startLogStream = (sessionId: string): Promise<EventSource> => {
    console.log("🔍 Creating EventSource for session:", sessionId)
    return new Promise((resolve, reject) => {
      // Check if EventSource is available (browser environment)
      if (typeof EventSource === 'undefined') {
        reject(new Error('EventSource not available in this environment'))
        return
      }

      const eventSource = new EventSource(`/api/upload-logs?sessionId=${sessionId}`)
      console.log("📡 EventSource created, waiting for connection...")

      eventSource.onopen = () => {
        console.log("✅ Log stream connected successfully")
        resolve(eventSource)
      }

      eventSource.onmessage = (event) => {
        try {
          const logEntry: LogEntry = JSON.parse(event.data)
          console.log("📨 Received log entry:", logEntry) // Debug log
          setLogs((prev: LogEntry[]) => [...prev, logEntry])

          // Update status to processing when we receive first processing log
          if (logEntry.message.includes("Processing") || logEntry.message.includes("Device")) {
            setUploadStatus((prev) => ({
              ...prev,
              status: "processing",
              message: "Processing ZIP with binary file extraction...",
            }));
          }

          // Progress bar update from [PROGRESS] log
          if (logEntry.message.startsWith('[PROGRESS]')) {
            console.log("📊 Processing progress log:", logEntry.message) // Debug log
            const match = logEntry.message.match(/\[PROGRESS\] (\d+)\/(\d+)/);
            if (match) {
              const processed = parseInt(match[1], 10);
              const total = parseInt(match[2], 10);
              if (total > 0) {
                const progressPercent = Math.round((processed / total) * 100);
                console.log(`📈 Updating progress: ${progressPercent}%`) // Debug log
                setUploadStatus((prev) => ({
                  ...prev,
                  progress: progressPercent,
                  message: `Processing files... (${processed} / ${total})`,
                }));
              }
            }
          }
        } catch (error) {
          console.error("Failed to parse log entry:", error)
        }
      }

      eventSource.onerror = (error) => {
        console.error("Log stream error:", error)
        eventSource.close()
        reject(error)
      }

      // Timeout fallback
      setTimeout(() => {
        if (eventSource.readyState !== EventSource.OPEN) {
          console.warn("Log stream connection timeout, proceeding anyway")
          resolve(eventSource)
        }
      }, 2000) // 2 second timeout
    })
  }

  const handleFile = async (file: File) => {
    console.log("🔍 handleFile called with file:", file.name, file.size, file.type)

    if (!file.name.toLowerCase().endsWith(".zip")) {
      console.log("❌ File rejected: not a ZIP file")
      setUploadStatus({
        status: "error",
        message: "Only .zip files are allowed",
        progress: 0,
        errorDetails: "Please select a valid ZIP file containing stealer logs data.",
      })
      return
    }

    console.log("✅ File accepted, proceeding with upload")

    // Generate session ID dan clear logs
    const sessionId = `upload_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    setLogSessionId(sessionId)
    setLogs([])

    // Step 1: Connecting to log stream
    setUploadStatus({
      status: "uploading",
      message: "Connecting to log stream...",
      progress: 0,
    })

    let logStream: EventSource | null = null

    try {
      // Start log streaming and wait for connection
      logStream = await startLogStream(sessionId)

      const formData = new FormData()
      formData.append("file", file)
      formData.append("sessionId", sessionId) // Add session ID

      // Step 2: Start upload
      setUploadStatus({
        status: "uploading",
        message: "Uploading file...",
        progress: 0,
      })

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      // Don't set processing status here - let it be updated from log stream

      // Don't override status here - let log stream handle it

      if (response.ok) {
        const result = await response.json()

        // Step 4: Success
        setUploadStatus({
          status: "success",
          message: "File processed successfully with binary file support!",
          progress: 100,
          details: result.details,
        })
      } else {
        const errorData = await response.json()
        throw new Error(errorData.details || errorData.error || "Upload failed")
      }
    } catch (error) {
      console.error("Upload error:", error)
      setUploadStatus({
        status: "error",
        message: "Upload failed. Please try again.",
        progress: 0,
        errorDetails:
          error instanceof Error
            ? error.message
            : "An unexpected error occurred during upload. Please check your file and try again.",
      })
    } finally {
      // Close log stream after a delay
      setTimeout(() => {
        if (logStream) {
          logStream.close()
        }
      }, 2000)
    }
  }

  const resetUpload = () => {
    setUploadStatus({
      status: "idle",
      message: "",
      progress: 0,
    })
    setLogs([]) // Clear logs
    setLogSessionId("") // Clear session ID
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <main className="flex-1 p-6 bg-bron-bg-primary">
      <div className="max-w-7xl mx-auto space-y-6">
        <Alert className="bg-bron-accent-blue/10 border-bron-accent-blue/30">
          <Info className="h-4 w-4 text-bron-accent-blue" />
          <AlertDescription className="text-bron-text-primary">
            Enhanced upload with binary file support! Text files are stored in database, binary files are saved to
            local storage with automatic duplicate detection.
          </AlertDescription>
        </Alert>

        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardHeader>
            <CardTitle className="text-bron-text-primary">Upload ZIP File</CardTitle>
            <CardDescription className="text-bron-text-muted">
              Upload a .zip file containing stealer logs data. The system will automatically extract both text and
              binary files, with duplicate device detection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
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
                  <p className="text-lg font-medium text-bron-text-primary">Drop your .zip file here</p>
                  <p className="text-sm text-bron-text-muted">or click to browse</p>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 bg-bron-accent-red hover:bg-bron-accent-red-hover text-white"
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Select File
                </Button>
                <input ref={fileInputRef} type="file" accept=".zip" onChange={handleFileInput} className="hidden" />
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

              {(uploadStatus.status === "processing") && (
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Upload className="h-4 w-4 animate-pulse text-bron-accent-blue" />
                      <span className="text-bron-text-primary">Processing data...</span>
                    </div>
                    <div className="text-sm font-medium text-bron-accent-blue">{uploadStatus.progress}%</div>
                  </div>
                  <Progress value={uploadStatus.progress} className="w-full" />
                  {/* Realtime Logs Window */}
                  {(logs.length > 0) &&
                    <Card className="bg-bron-bg-tertiary border-bron-border">
                      <CardHeader>
                        <CardTitle className="flex items-center text-bron-text-primary">
                          <Monitor className="h-4 w-4 mr-2 text-bron-accent-blue" />
                          Processing Logs
                          {logs.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="ml-2 bg-bron-bg-secondary text-bron-text-muted border-bron-border"
                            >
                              {logs.length} entries
                            </Badge>
                          )}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ScrollArea ref={scrollAreaRef} className="h-64 w-full">
                          <div className="space-y-1 font-mono text-xs">
                            {logs.map((log, index) => (
                              <div
                                key={index}
                                className={`p-2 rounded border-l-2 ${
                                  log.type === "error"
                                    ? "bg-bron-accent-red/10 border-l-bron-accent-red text-bron-accent-red"
                                    : log.type === "success"
                                      ? "bg-bron-accent-green/10 border-l-bron-accent-green text-bron-accent-green"
                                      : log.type === "warning"
                                        ? "bg-bron-accent-yellow/10 border-l-bron-accent-yellow text-bron-accent-yellow"
                                        : "bg-bron-bg-secondary border-l-bron-accent-blue text-bron-text-primary"
                                }`}
                              >
                                <div className="flex items-start space-x-2">
                                  <span className="text-bron-text-muted text-xs shrink-0">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                  </span>
                                  <span className="break-all">{log.message}</span>
                                </div>
                              </div>
                            ))}
                            {logs.length === 0 && (
                                <div className="text-center py-4 text-bron-text-muted">
                                  <p>Waiting for processing logs...</p>
                                </div>
                              )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  }
                  <div className="text-xs text-bron-text-muted text-center">
                    {uploadStatus.status === "processing" && "Extracting ZIP contents and saving binary files..."}
                  </div>
                </div>
              )}

            {uploadStatus.status === "success" && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-bron-accent-green">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{uploadStatus.message}</span>
                </div>
                {uploadStatus.details && (
                  <div className="space-y-4">
                    <div className="bg-bron-accent-green/10 border border-bron-accent-green/30 rounded-lg p-4">
                      <h4 className="font-medium text-bron-accent-green mb-2">Processing Results:</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm text-bron-text-primary">
                        <div>
                          <p>
                            • Devices found:{" "}
                            <span className="font-mono text-bron-accent-blue">
                              {uploadStatus.details.devicesFound}
                            </span>
                          </p>
                          <p>
                            • Devices processed:{" "}
                            <span className="font-mono text-bron-accent-green">
                              {uploadStatus.details.devicesProcessed}
                            </span>
                          </p>
                          <p>
                            • Files extracted:{" "}
                            <span className="font-mono text-bron-text-primary">
                              {uploadStatus.details.totalFiles.toLocaleString()}
                            </span>
                          </p>
                          <p>
                            • Credentials found:{" "}
                            <span className="font-mono text-bron-accent-green">
                              {uploadStatus.details.totalCredentials.toLocaleString()}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p>
                            • Binary files saved:{" "}
                            <span className="font-mono text-bron-accent-blue">
                              {uploadStatus.details.totalBinaryFiles?.toLocaleString() || 0}
                            </span>
                          </p>
                          <p>
                            • Unique domains:{" "}
                            <span className="font-mono text-bron-accent-blue">
                              {uploadStatus.details.totalDomains.toLocaleString()}
                            </span>
                          </p>
                          <p>
                            • Total URLs:{" "}
                            <span className="font-mono text-bron-text-primary">
                              {uploadStatus.details.totalUrls.toLocaleString()}
                            </span>
                          </p>
                          <p>
                            • Upload batch:{" "}
                            <span className="font-mono text-bron-text-muted text-xs">
                              {uploadStatus.details.uploadBatch}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {uploadStatus.details.devicesSkipped > 0 && uploadStatus.details.skippedDevices.length > 0 && (
                      <div className="bg-bron-accent-yellow/10 border border-bron-accent-yellow/30 rounded-lg p-4">
                        <h4 className="font-medium text-bron-accent-yellow mb-2 flex items-center">
                          <SkipForward className="h-4 w-4 mr-2" />
                          Duplicate Detection Results:
                        </h4>
                        <p className="text-sm text-bron-text-primary mb-2">
                          {uploadStatus.details.devicesSkipped} devices were skipped as duplicates:
                        </p>
                        <div className="text-xs text-bron-text-primary max-h-32 overflow-y-auto">
                          {uploadStatus.details.skippedDevices.map((device, index) => (
                            <span
                              key={index}
                              className="inline-block bg-bron-accent-yellow/20 border border-bron-accent-yellow/40 rounded px-2 py-1 mr-1 mb-1 font-mono"
                            >
                              {device}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploadStatus.details.processedDevices.length > 0 && (
                      <div className="bg-bron-accent-blue/10 border border-bron-accent-blue/30 rounded-lg p-4">
                        <h4 className="font-medium text-bron-accent-blue mb-2">New Devices Processed:</h4>
                        <div className="text-xs text-bron-text-primary max-h-32 overflow-y-auto">
                          {uploadStatus.details.processedDevices.map((device, index) => (
                            <span
                              key={index}
                              className="inline-block bg-bron-accent-blue/20 border border-bron-accent-blue/40 rounded px-2 py-1 mr-1 mb-1 font-mono"
                            >
                              {device}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploadStatus.details.totalBinaryFiles && uploadStatus.details.totalBinaryFiles > 0 && (
                      <div className="bg-bron-accent-green/10 border border-bron-accent-green/30 rounded-lg p-4">
                        <h4 className="font-medium text-bron-accent-green mb-2 flex items-center">
                          <HardDrive className="h-4 w-4 mr-2" />
                          Binary Files Extracted:
                        </h4>
                        <p className="text-sm text-bron-text-primary">
                          {uploadStatus.details.totalBinaryFiles.toLocaleString()} binary files (images, documents,
                          etc.) have been saved to local storage and will be included in downloads.
                        </p>
                      </div>
                    )}
                  </div>
                )}
                <Button
                  onClick={resetUpload}
                  variant="outline"
                  className="bg-bron-bg-secondary border-bron-border text-bron-text-primary hover:bg-bron-bg-tertiary"
                >
                  Upload Another File
                </Button>
              </div>
            )}

            {uploadStatus.status === "error" && (
              <div className="space-y-4">
                <div className="bg-bron-accent-red/10 border border-bron-accent-red/30 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-bron-accent-red mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Upload Failed</span>
                  </div>
                  <p className="text-sm text-bron-text-primary mb-2">{uploadStatus.message}</p>
                  {uploadStatus.errorDetails && (
                    <div className="bg-bron-accent-red/20 rounded p-3 text-xs text-bron-text-primary">
                      <strong>Error Details:</strong>
                      <br />
                      {uploadStatus.errorDetails}
                    </div>
                  )}
                </div>
                <Button
                  onClick={resetUpload}
                  variant="outline"
                  className="bg-bron-bg-secondary border-bron-border text-bron-text-primary hover:bg-bron-bg-tertiary"
                >
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="bg-bron-bg-tertiary border-bron-border">
          <CardHeader>
            <CardTitle className="text-bron-text-primary">Enhanced Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-bron-text-muted grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              <li><CheckCircle className="inline h-4 w-4 text-bron-accent-green mr-1" /> Complete binary file extraction and storage</li>
              <li><CheckCircle className="inline h-4 w-4 text-bron-accent-green mr-1" /> Automatic duplicate detection based on device names</li>
              <li><CheckCircle className="inline h-4 w-4 text-bron-accent-green mr-1" /> Advanced analytics: Top TLDs, domain/URL extraction</li>
              <li><CheckCircle className="inline h-4 w-4 text-bron-accent-green mr-1" /> Local storage for binary files (images, documents, etc.)</li>
              <li><CheckCircle className="inline h-4 w-4 text-bron-accent-green mr-1" /> Comprehensive download with both text and binary files</li>
              <li><CheckCircle className="inline h-4 w-4 text-bron-accent-green mr-1" /> JSON format credentials export for tool integration</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
