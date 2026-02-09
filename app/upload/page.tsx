"use client";
export const dynamic = "force-dynamic";

import type React from "react"
import { useState, useRef, useEffect } from "react"
import { Upload, FileArchive, CheckCircle, AlertCircle, Info, SkipForward, HardDrive, Monitor, X, ShieldAlert, Activity, Loader2, ChevronRight } from "lucide-react"
import { uploadFileInChunks, assembleAndProcessFile } from "@/lib/upload/chunk-uploader"
import { formatBytes } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { useAuth, isAdmin } from "@/hooks/useAuth"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface UploadStatus {
  status: "idle" | "uploading" | "processing" | "monitoring" | "success" | "error"
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
  // Auth state - check if user has admin role
  const { user, loading: authLoading } = useAuth(true)
  const userIsAdmin = isAdmin(user)
  const { toast } = useToast()

  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({
    status: "idle",
    message: "",
    progress: 0,
  })
  const [dragActive, setDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add new state:
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [_logSessionId, setLogSessionId] = useState<string>("")
  // Ref untuk auto scroll log (pada ScrollArea)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  
  // AbortController for cancelling uploads
  const abortControllerRef = useRef<AbortController | null>(null)
  
  // Stream data preference from database
  const [streamEnabled, setStreamEnabled] = useState(true)
  const [savingPreference, setSavingPreference] = useState(false)
  const [showInfoBanner, setShowInfoBanner] = useState(true)
  
  // Load stream preference from database on mount
  useEffect(() => {
    async function loadStreamPreference() {
      try {
        const response = await fetch("/api/user/preferences")
        if (response.ok) {
          const data = await response.json()
          if (data.success && data.preferences) {
            setStreamEnabled(data.preferences.stream_enabled ?? true)
          }
        }
      } catch (error) {
        console.error("Failed to load stream preference:", error)
        // Default to enabled on error
      }
    }
    loadStreamPreference()
  }, [])

  // Handle quick toggle for stream preference
  const handleQuickToggle = async (checked: boolean) => {
    // Optimistic update
    const previousValue = streamEnabled
    setStreamEnabled(checked)
    setSavingPreference(true)

    try {
      const response = await fetch("/api/user/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream_enabled: checked }),
        credentials: "include",
      })

      if (response.ok) {
        toast({
          title: checked ? "Stream Data Enabled" : "Stream Data Disabled",
          description: checked 
            ? "Real-time progress will be shown during upload and parsing" 
            : "Progress will be hidden during upload and parsing for better performance",
        })
      } else {
        // Revert on error
        setStreamEnabled(previousValue)
        const data = await response.json()
        toast({
          title: "Error",
          description: data.error || "Failed to save preference",
          variant: "destructive",
        })
      }
    } catch (error) {
      // Revert on error
      setStreamEnabled(previousValue)
      console.error("Failed to save preference:", error)
      toast({
        title: "Error",
        description: "Failed to save preference. Please try again.",
        variant: "destructive",
      })
    } finally {
      setSavingPreference(false)
    }
  }
  
  // Upload settings state
  const [uploadSettings, setUploadSettings] = useState<{
    maxFileSize: number
    chunkSize: number
    maxConcurrentChunks: number
  } | null>(null)

  // Auto-scroll to the bottom whenever the logs update.
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
      }
    }
  }, [logs])

  // Load upload settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const response = await fetch("/api/settings/upload")
        if (response.ok) {
          const data = await response.json()
          setUploadSettings({
            maxFileSize: data.maxFileSize,
            chunkSize: data.chunkSize,
            maxConcurrentChunks: data.maxConcurrentChunks,
          })
        }
      } catch (error) {
        console.error("Failed to load upload settings:", error)
        // Use defaults if settings fail to load (these should match database defaults)
        // Note: These are fallback values only - settings should be loaded from database
        setUploadSettings({
          maxFileSize: 10737418240, // 10GB (default from database)
          chunkSize: 10485760, // 10MB (default from database)
          maxConcurrentChunks: 3, // (default from database)
        })
      }
    }
    loadSettings()
  }, [])

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
                  message: `Processing devices... (${processed} / ${total})`,
                }));
              }
            }
          }

          // Domain monitor check progress
          if (logEntry.message.startsWith('[MONITOR_CHECK]')) {
            const msg = logEntry.message.replace('[MONITOR_CHECK] ', '');
            setUploadStatus((prev) => ({
              ...prev,
              status: 'monitoring',
              message: msg,
            }));
          }

          // Domain monitor progress bar (separate phase from processing)
          if (logEntry.message.startsWith('[MONITOR_PROGRESS]')) {
            const match = logEntry.message.match(/\[MONITOR_PROGRESS\] (\d+)\/(\d+)\s*(.*)/);
            if (match) {
              const current = parseInt(match[1], 10);
              const total = parseInt(match[2], 10);
              const stepMessage = match[3] || '';
              if (total > 0) {
                const progressPercent = Math.round((current / total) * 100);
                setUploadStatus((prev) => ({
                  ...prev,
                  status: 'monitoring',
                  progress: progressPercent,
                  message: stepMessage || `Checking domain monitors... (${current}/${total})`,
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

    // Wait for settings to load if not loaded yet
    if (!uploadSettings) {
      setUploadStatus({
        status: "error",
        message: "Loading settings...",
        progress: 0,
        errorDetails: "Please wait for settings to load and try again.",
      })
      return
    }

    // Check file size against limit
    if (file.size > uploadSettings.maxFileSize) {
      setUploadStatus({
        status: "error",
        message: "File size exceeds maximum allowed size",
        progress: 0,
        errorDetails: `File size (${formatBytes(file.size)}) exceeds maximum allowed size (${formatBytes(uploadSettings.maxFileSize)}). Please adjust the limit in Settings or use a smaller file.`,
      })
      return
    }

    console.log("✅ File accepted, proceeding with upload")

    // Create new AbortController for this upload
    abortControllerRef.current = new AbortController()
    const signal = abortControllerRef.current.signal

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

      // Determine upload method based on file size
      // Use chunked upload for files >= 100MB, regular upload for smaller files
      const CHUNKED_UPLOAD_THRESHOLD = 100 * 1024 * 1024 // 100MB
      const useChunkedUpload = file.size >= CHUNKED_UPLOAD_THRESHOLD

      console.log("🔍 Upload method decision:", {
        fileSize: formatBytes(file.size),
        fileSizeBytes: file.size,
        threshold: formatBytes(CHUNKED_UPLOAD_THRESHOLD),
        useChunkedUpload,
        chunkSize: formatBytes(uploadSettings.chunkSize),
        maxConcurrentChunks: uploadSettings.maxConcurrentChunks,
      })

      if (useChunkedUpload) {
        // Use chunked upload for large files
        console.log("📦 Using CHUNKED UPLOAD for large file")
        console.log(`📊 File will be split into ~${Math.ceil(file.size / uploadSettings.chunkSize)} chunks`)
        
        setUploadStatus({
          status: "uploading",
          message: "Uploading file in chunks...",
          progress: 0,
        })

        // Upload chunks
        console.log("🚀 Starting chunked upload process...")
        const uploadResult = await uploadFileInChunks(file, sessionId, {
          chunkSize: uploadSettings.chunkSize,
          maxConcurrentChunks: uploadSettings.maxConcurrentChunks,
          signal: signal, // Pass abort signal for cancellation
          onProgress: (progress, uploaded, total) => {
            console.log(`📈 Chunk upload progress: ${uploaded}/${total} chunks (${Math.round(progress)}%)`)
            setUploadStatus((prev) => ({
              ...prev,
              progress: Math.round(progress),
              message: `Uploading chunks... (${uploaded}/${total})`,
            }))
          },
          onChunkComplete: (chunkIndex, totalChunks) => {
            console.log(`✅ Chunk ${chunkIndex + 1}/${totalChunks} uploaded successfully`)
          },
          onError: (error, chunkIndex) => {
            console.error(`❌ Error uploading chunk ${chunkIndex}:`, error)
          },
        })

        console.log("📦 Chunk upload completed:", uploadResult)

        // Check if upload was aborted
        if (uploadResult.aborted) {
          setUploadStatus({
            status: "idle",
            message: "Upload cancelled",
            progress: 0,
          })
          return
        }

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || "Failed to upload chunks")
        }

        // Assemble and process
        setUploadStatus({
          status: "processing",
          message: "Assembling file and starting processing...",
          progress: 100,
        })

        const processResult = await assembleAndProcessFile(uploadResult.fileId, file.name, sessionId)

        if (!processResult.success) {
          throw new Error(processResult.error || "Failed to process file")
        }

        // Success
        setUploadStatus({
          status: "success",
          message: "File processed successfully with binary file support!",
          progress: 100,
          details: processResult.details,
        })
      } else {
        // Use regular upload for small files (backward compatible)
        console.log("📦 Using REGULAR UPLOAD for small file (backward compatible)")
        
      setUploadStatus({
        status: "uploading",
        message: "Uploading file...",
        progress: 0,
      })

        const formData = new FormData()
        formData.append("file", file)
        formData.append("sessionId", sessionId)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
          signal: signal, // Pass abort signal for cancellation
      })

      if (response.ok) {
        const result = await response.json()

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
      }
    } catch (error: any) {
      // Don't show error if upload was cancelled
      if (error.name === 'AbortError' || signal?.aborted) {
        setUploadStatus({
          status: "idle",
          message: "Upload cancelled",
          progress: 0,
        })
        return
      }

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
      
      // Clear abort controller
      abortControllerRef.current = null
    }
  }

  const cancelUpload = () => {
    if (abortControllerRef.current) {
      console.log("🛑 Cancelling upload...")
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
  }

  const resetUpload = () => {
    // Cancel any ongoing upload
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }

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

  // Show loading while checking auth
  if (authLoading) {
    return (
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-7xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Checking permissions...</p>
          </div>
        </div>
      </main>
    )
  }

  // Access denied for non-admin users (analysts)
  if (!userIsAdmin) {
    return (
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-7xl mx-auto space-y-6">
          <Card className="glass-card border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle className="text-foreground">Access Denied</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    You don&apos;t have permission to upload data
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-destructive/30 bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-foreground">
                  <strong>Analyst Role Restriction:</strong> Your account has read-only access. 
                  Only administrators can upload and modify data in the system.
                </AlertDescription>
              </Alert>
              <div className="text-sm text-muted-foreground">
                <p>As an analyst, you can:</p>
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Search and view credentials</li>
                  <li>Browse device information</li>
                  <li>View analytics and statistics</li>
                  <li>Export and download reports</li>
                </ul>
              </div>
              <div className="pt-4">
                <Button variant="outline" onClick={() => window.history.back()}>
                  Go Back
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 p-6 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        <Alert className="glass-card border-primary/30 backdrop-blur-sm">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-foreground">
            Enhanced upload with binary file support! Text files are stored in database, binary files are saved to
            local storage with automatic duplicate detection.
          </AlertDescription>
        </Alert>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground">Upload ZIP File</CardTitle>
            <CardDescription className="text-muted-foreground">
              Upload a .zip file containing stealer logs data. The system will automatically extract both text and
              binary files, with duplicate device detection.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Quick Toggle for Stream Data Preference */}
            {uploadStatus.status === "idle" && (
              <div className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/10">
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="stream-toggle-quick" className="text-sm font-medium cursor-pointer text-foreground">
                        Show Stream Data During Upload
                      </Label>
                      <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                        Your preference
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Display real-time parsing progress and logs. Disabling may improve performance for large files.
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {savingPreference && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                  <Switch
                    id="stream-toggle-quick"
                    checked={streamEnabled}
                    onCheckedChange={handleQuickToggle}
                    disabled={savingPreference}
                  />
                </div>
              </div>
            )}

            {/* Info Banner - Collapsible */}
            {uploadStatus.status === "idle" && showInfoBanner && (
              <Alert className="glass-card border-blue-500/20 bg-blue-500/5">
                <Info className="h-4 w-4 text-blue-500" />
                <AlertDescription className="text-sm text-foreground">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="mb-1">
                        <strong>Stream Data</strong> shows real-time progress such as credentials found, file parsing status, 
                        and system information extraction during upload. This is your personal preference and can be 
                        changed anytime.
                      </p>
                      <Link 
                        href="/user-settings?tab=preferences"
                        className="inline-flex items-center gap-1 text-primary hover:text-primary/80 text-xs font-medium mt-1 transition-colors"
                      >
                        Manage all preferences
                        <ChevronRight className="h-3 w-3" />
                      </Link>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 hover:bg-transparent"
                      onClick={() => setShowInfoBanner(false)}
                      aria-label="Close info banner"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {uploadStatus.status === "idle" && (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 backdrop-blur-sm ${
                  dragActive
                    ? "border-primary bg-primary/20 backdrop-blur-md shadow-lg"
                    : "border-border/50 bg-card/30 hover:border-primary/50 hover:bg-card/40 hover:backdrop-blur-md"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <FileArchive className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <div className="space-y-2">
                  <p className="text-lg font-medium text-foreground">Drop your .zip file here</p>
                  <p className="text-sm text-muted-foreground">or click to browse</p>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 bg-primary hover:bg-primary-hover text-white"
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
                    <Upload className="h-4 w-4 animate-pulse text-primary" />
                    <span className="text-foreground">{uploadStatus.message || "Uploading file..."}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                  <div className="text-sm font-medium text-primary">{uploadStatus.progress}%</div>
                    <Button
                      onClick={cancelUpload}
                      variant="outline"
                      size="sm"
                      className="bg-primary/10 border-destructive/30 text-destructive hover:bg-primary/20"
                    >
                      <X className="h-4 w-4 mr-1" />
                      Cancel
                    </Button>
                  </div>
                </div>
                <Progress value={uploadStatus.progress} className="w-full" />
              </div>
            )}

              {(uploadStatus.status === "processing" || uploadStatus.status === "monitoring") && (
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      {uploadStatus.status === "monitoring" ? (
                        <Activity className="h-4 w-4 animate-pulse text-amber-500" />
                      ) : (
                        <Upload className="h-4 w-4 animate-pulse text-primary" />
                      )}
                      <span className="text-foreground">
                        {uploadStatus.status === "monitoring" 
                          ? uploadStatus.message || "Checking domain monitors..."
                          : "Processing data..."
                        }
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      {uploadStatus.status === "monitoring" && (
                        <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-500">
                          Monitor Check
                        </Badge>
                      )}
                      <div className="text-sm font-medium text-primary">{uploadStatus.progress}%</div>
                    </div>
                  </div>
                  <Progress value={uploadStatus.progress} className="w-full" />
                  {/* Realtime Logs Window - Only show if stream is enabled */}
                  {streamEnabled && (logs.length > 0) &&
                    <Card className="glass-card border-border/50">
                      <CardHeader>
                        <CardTitle className="flex items-center text-foreground">
                          <Monitor className="h-4 w-4 mr-2 text-primary" />
                          Processing Logs
                          {logs.length > 0 && (
                            <Badge
                              variant="secondary"
                              className="ml-2 glass text-muted-foreground border-border"
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
                                    ? "bg-primary/10 border-l-bron-accent-red text-destructive"
                                    : log.type === "success"
                                      ? "bg-emerald-500/10 border-l-bron-accent-green text-emerald-500"
                                      : log.type === "warning"
                                        ? "bg-amber-500/10 border-l-bron-accent-yellow text-amber-500"
                                        : "glass border-l-bron-accent-blue text-foreground"
                                }`}
                              >
                                <div className="flex items-start space-x-2">
                                  <span className="text-muted-foreground text-xs shrink-0">
                                    {new Date(log.timestamp).toLocaleTimeString()}
                                  </span>
                                  <span className="break-all">{log.message}</span>
                                </div>
                              </div>
                            ))}
                            {logs.length === 0 && (
                                <div className="text-center py-4 text-muted-foreground">
                                  <p>Waiting for processing logs...</p>
                                </div>
                              )}
                          </div>
                        </ScrollArea>
                      </CardContent>
                    </Card>
                  }
                  <div className="text-xs text-muted-foreground text-center">
                    {uploadStatus.status === "processing" && "Extracting ZIP contents and saving binary files..."}
                    {uploadStatus.status === "monitoring" && "Checking uploaded data against active domain monitors..."}
                  </div>
                </div>
              )}

            {uploadStatus.status === "success" && (
              <div className="space-y-4">
                <div className="flex items-center space-x-2 text-emerald-500">
                  <CheckCircle className="h-5 w-5" />
                  <span className="font-medium">{uploadStatus.message}</span>
                </div>
                {uploadStatus.details && (
                  <div className="space-y-4">
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 backdrop-blur-sm glass-card">
                      <h4 className="font-medium text-emerald-500 mb-2">Processing Results:</h4>
                      <div className="grid grid-cols-2 gap-4 text-sm text-foreground">
                        <div>
                          <p>
                            • Devices found:{" "}
                            <span className="font-mono text-primary">
                              {uploadStatus.details.devicesFound}
                            </span>
                          </p>
                          <p>
                            • Devices processed:{" "}
                            <span className="font-mono text-emerald-500">
                              {uploadStatus.details.devicesProcessed}
                            </span>
                          </p>
                          <p>
                            • Files extracted:{" "}
                            <span className="font-mono text-foreground">
                              {uploadStatus.details.totalFiles.toLocaleString()}
                            </span>
                          </p>
                          <p>
                            • Credentials found:{" "}
                            <span className="font-mono text-emerald-500">
                              {uploadStatus.details.totalCredentials.toLocaleString()}
                            </span>
                          </p>
                        </div>
                        <div>
                          <p>
                            • Binary files saved:{" "}
                            <span className="font-mono text-primary">
                              {uploadStatus.details.totalBinaryFiles?.toLocaleString() || 0}
                            </span>
                          </p>
                          <p>
                            • Unique domains:{" "}
                            <span className="font-mono text-primary">
                              {uploadStatus.details.totalDomains.toLocaleString()}
                            </span>
                          </p>
                          <p>
                            • Total URLs:{" "}
                            <span className="font-mono text-foreground">
                              {uploadStatus.details.totalUrls.toLocaleString()}
                            </span>
                          </p>
                          <p>
                            • Upload batch:{" "}
                            <span className="font-mono text-muted-foreground text-xs">
                              {uploadStatus.details.uploadBatch}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {uploadStatus.details.devicesSkipped > 0 && uploadStatus.details.skippedDevices.length > 0 && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 backdrop-blur-sm glass-card">
                        <h4 className="font-medium text-amber-500 mb-2 flex items-center">
                          <SkipForward className="h-4 w-4 mr-2" />
                          Duplicate Detection Results:
                        </h4>
                        <p className="text-sm text-foreground mb-2">
                          {uploadStatus.details.devicesSkipped} devices were skipped as duplicates:
                        </p>
                        <div className="text-xs text-foreground max-h-32 overflow-y-auto">
                          {uploadStatus.details.skippedDevices.map((device, index) => (
                            <span
                              key={index}
                              className="inline-block bg-amber-500/20 border border-amber-500/40 rounded px-2 py-1 mr-1 mb-1 font-mono"
                            >
                              {device}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploadStatus.details.processedDevices.length > 0 && (
                      <div className="bg-primary/10 border border-primary/30 rounded-lg p-4 backdrop-blur-sm glass-card">
                        <h4 className="font-medium text-primary mb-2">New Devices Processed:</h4>
                        <div className="text-xs text-foreground max-h-32 overflow-y-auto">
                          {uploadStatus.details.processedDevices.map((device, index) => (
                            <span
                              key={index}
                              className="inline-block bg-primary/20 border border-primary/40 rounded px-2 py-1 mr-1 mb-1 font-mono"
                            >
                              {device}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {uploadStatus.details.totalBinaryFiles && uploadStatus.details.totalBinaryFiles > 0 && (
                      <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 backdrop-blur-sm glass-card">
                        <h4 className="font-medium text-emerald-500 mb-2 flex items-center">
                          <HardDrive className="h-4 w-4 mr-2" />
                          Binary Files Extracted:
                        </h4>
                        <p className="text-sm text-foreground">
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
                  className="glass border-border text-foreground hover:bg-secondary"
                >
                  Upload Another File
                </Button>
              </div>
            )}

            {uploadStatus.status === "error" && (
              <div className="space-y-4">
                <div className="bg-primary/10 border border-destructive/30 rounded-lg p-4 backdrop-blur-sm glass-card">
                  <div className="flex items-center space-x-2 text-destructive mb-2">
                    <AlertCircle className="h-5 w-5" />
                    <span className="font-medium">Upload Failed</span>
                  </div>
                  <p className="text-sm text-foreground mb-2">{uploadStatus.message}</p>
                  {uploadStatus.errorDetails && (
                    <div className="bg-primary/20 rounded p-3 text-xs text-foreground">
                      <strong>Error Details:</strong>
                      <br />
                      {uploadStatus.errorDetails}
                    </div>
                  )}
                </div>
                <Button
                  onClick={resetUpload}
                  variant="outline"
                  className="glass border-border text-foreground hover:bg-secondary"
                >
                  Try Again
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="glass-card border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground">Enhanced Features</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="text-sm text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
              <li><CheckCircle className="inline h-4 w-4 text-emerald-500 mr-1" /> Complete binary file extraction and storage</li>
              <li><CheckCircle className="inline h-4 w-4 text-emerald-500 mr-1" /> Automatic duplicate detection based on device names</li>
              <li><CheckCircle className="inline h-4 w-4 text-emerald-500 mr-1" /> Advanced analytics: Top TLDs, domain/URL extraction</li>
              <li><CheckCircle className="inline h-4 w-4 text-emerald-500 mr-1" /> Local storage for binary files (images, documents, etc.)</li>
              <li><CheckCircle className="inline h-4 w-4 text-emerald-500 mr-1" /> Comprehensive download with both text and binary files</li>
              <li><CheckCircle className="inline h-4 w-4 text-emerald-500 mr-1" /> JSON format credentials export for tool integration</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
