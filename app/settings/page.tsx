"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Settings, Save, AlertCircle, Info, Upload, Database, ShieldAlert, HardDrive, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { formatBytes } from "@/lib/utils"
import { useAuth, isAdmin } from "@/hooks/useAuth"

interface UploadSettings {
  maxFileSize: number
  chunkSize: number
  maxConcurrentChunks: number
  apiConcurrency: number
  tempCleanupHours: number
  apiMaxDurationSeconds: number
}

interface SettingsFormData {
  maxFileSizeGB: number
  chunkSizeMB: number
  maxConcurrentChunks: number
  apiConcurrency: number
  tempCleanupHours: number
  apiMaxDurationSeconds: number
}

interface BatchSettings {
  credentialsBatchSize: number
  passwordStatsBatchSize: number
  filesBatchSize: number
  fileWriteParallelLimit: number
}

interface BatchFormData {
  credentialsBatchSize: number
  passwordStatsBatchSize: number
  filesBatchSize: number
  fileWriteParallelLimit: number
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast: _toast } = useToast()
  
  // Auth state - check if user has admin role
  const { user, loading: authLoading } = useAuth(true)
  const userIsAdmin = isAdmin(user)
  
  // Tab state - sync with URL
  const [activeTab, setActiveTab] = useState<string>(searchParams.get('tab') || 'upload')
  
  // Sync state with URL when URL changes (e.g., browser back/forward)
  useEffect(() => {
    const tabFromUrl = searchParams.get('tab') || 'upload'
    if (tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl)
    }
  }, [searchParams, activeTab])

  const handleTabChange = (tab: string) => {
    // Update state immediately for instant UI response
    setActiveTab(tab)
    // Update URL asynchronously for bookmarking
    router.replace(`/settings?tab=${tab}`, { scroll: false })
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-4xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Checking permissions...</p>
          </div>
        </div>
      </main>
    )
  }

  // Access denied for non-admin users
  if (!userIsAdmin) {
    return (
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card className="glass-card border-destructive/50">
            <CardHeader>
              <div className="flex items-center gap-3">
                <ShieldAlert className="h-8 w-8 text-destructive" />
                <div>
                  <CardTitle className="text-foreground">Access Denied</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    You don&apos;t have permission to access settings
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-destructive/30 bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-foreground">
                  <strong>Admin Role Required:</strong> Only administrators can access and modify application settings.
                </AlertDescription>
              </Alert>
              <div className="pt-4">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  Go to Dashboard
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="flex-1 p-6 bg-transparent">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-muted-foreground mt-2">Configure application settings</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="items-center justify-center rounded-md p-1 text-muted-foreground grid w-full grid-cols-3 glass-card h-8">
            <TabsTrigger
              value="upload"
              className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <Upload className="h-3 w-3 mr-1" />
              Upload
            </TabsTrigger>
            <TabsTrigger
              value="batch"
              className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <Database className="h-3 w-3 mr-1" />
              Database Batch
            </TabsTrigger>
            <TabsTrigger
              value="storage"
              className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <HardDrive className="h-3 w-3 mr-1" />
              Storage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <UploadConfigurationTab />
          </TabsContent>

          <TabsContent value="batch" className="mt-4">
            <BatchConfigurationTab />
          </TabsContent>

          <TabsContent value="storage" className="mt-4">
            <StorageConfigurationTab />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  )
}

function UploadConfigurationTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<UploadSettings | null>(null)
  const [formData, setFormData] = useState<SettingsFormData>({
    maxFileSizeGB: 10,
    chunkSizeMB: 10,
    maxConcurrentChunks: 3,
    apiConcurrency: 2,
    tempCleanupHours: 24,
    apiMaxDurationSeconds: 300,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof SettingsFormData, string>>>({})

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/settings/upload")
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        
        // Convert bytes to human-readable units for form
        setFormData({
          maxFileSizeGB: Math.round(data.maxFileSize / (1024 * 1024 * 1024) * 100) / 100,
          chunkSizeMB: Math.round(data.chunkSize / (1024 * 1024) * 100) / 100,
          maxConcurrentChunks: data.maxConcurrentChunks,
          apiConcurrency: data.apiConcurrency ?? 2,
          tempCleanupHours: data.tempCleanupHours ?? 24,
          apiMaxDurationSeconds: data.apiMaxDurationSeconds ?? 300,
        })
      } else {
        throw new Error("Failed to load settings")
      }
    } catch (error) {
      console.error("Error loading settings:", error)
      toast({
        title: "Error",
        description: "Failed to load settings. Using defaults.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof SettingsFormData, string>> = {}

    // Validate Max File Size (0.1 GB - 100 GB)
    if (formData.maxFileSizeGB < 0.1 || formData.maxFileSizeGB > 100) {
      newErrors.maxFileSizeGB = "Max file size must be between 0.1 GB and 100 GB"
    }

    // Validate Chunk Size (1 MB - 100 MB)
    if (formData.chunkSizeMB < 1 || formData.chunkSizeMB > 100) {
      newErrors.chunkSizeMB = "Chunk size must be between 1 MB and 100 MB"
    }

    // Validate Max Concurrent Chunks (1 - 10)
    if (formData.maxConcurrentChunks < 1 || formData.maxConcurrentChunks > 10) {
      newErrors.maxConcurrentChunks = "Max concurrent chunks must be between 1 and 10"
    }

    // Validate chunk size <= max file size / 10
    const maxFileSizeBytes = formData.maxFileSizeGB * 1024 * 1024 * 1024
    const chunkSizeBytes = formData.chunkSizeMB * 1024 * 1024
    if (chunkSizeBytes > maxFileSizeBytes / 10) {
      newErrors.chunkSizeMB = `Chunk size should be at most ${formatBytes(maxFileSizeBytes / 10)} (10% of max file size)`
    }

    // API key upload: concurrency 1–10, temp cleanup 1–168 h, max duration 60–86400 s
    if (formData.apiConcurrency < 1 || formData.apiConcurrency > 10) {
      newErrors.apiConcurrency = "API concurrency must be between 1 and 10"
    }
    if (formData.tempCleanupHours < 1 || formData.tempCleanupHours > 168) {
      newErrors.tempCleanupHours = "Temp cleanup hours must be between 1 and 168"
    }
    if (formData.apiMaxDurationSeconds < 60 || formData.apiMaxDurationSeconds > 86400) {
      newErrors.apiMaxDurationSeconds = "API max duration must be between 60 and 86400 seconds"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving.",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)

      // Convert form data to bytes
      const maxFileSizeBytes = Math.floor(formData.maxFileSizeGB * 1024 * 1024 * 1024)
      const chunkSizeBytes = Math.floor(formData.chunkSizeMB * 1024 * 1024)

      // Update settings
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: [
            {
              key_name: "upload_max_file_size",
              value: maxFileSizeBytes.toString(),
            },
            {
              key_name: "upload_chunk_size",
              value: chunkSizeBytes.toString(),
            },
            {
              key_name: "upload_max_concurrent_chunks",
              value: formData.maxConcurrentChunks.toString(),
            },
            {
              key_name: "upload_api_concurrency",
              value: formData.apiConcurrency.toString(),
            },
            {
              key_name: "upload_temp_cleanup_hours",
              value: formData.tempCleanupHours.toString(),
            },
            {
              key_name: "upload_api_max_duration_seconds",
              value: formData.apiMaxDurationSeconds.toString(),
            },
          ],
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Success",
          description: result.message || "Settings saved successfully",
        })
        
        // Reload settings
        await loadSettings()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save settings")
      }
    } catch (error) {
      console.error("Error saving settings:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (settings) {
      setFormData({
        maxFileSizeGB: Math.round(settings.maxFileSize / (1024 * 1024 * 1024) * 100) / 100,
        chunkSizeMB: Math.round(settings.chunkSize / (1024 * 1024) * 100) / 100,
        maxConcurrentChunks: settings.maxConcurrentChunks,
        apiConcurrency: settings.apiConcurrency ?? 2,
        tempCleanupHours: settings.tempCleanupHours ?? 24,
        apiMaxDurationSeconds: settings.apiMaxDurationSeconds ?? 300,
      })
      setErrors({})
    }
  }

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading settings...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-foreground">Upload Configuration</CardTitle>
        <CardDescription className="text-muted-foreground">
          Configure file upload limits and chunking behavior for large file uploads
        </CardDescription>
      </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border-2 border-blue-500/50 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground font-medium leading-relaxed">
                  These settings control how large files are uploaded. Files larger than 100MB will be automatically
                  split into chunks for efficient upload.
                </p>
              </div>
            </div>

            {/* Max File Size */}
            <div className="space-y-2">
              <Label htmlFor="maxFileSize" className="text-foreground">
                Maximum File Size (GB)
              </Label>
              <Input
                id="maxFileSize"
                type="number"
                min="0.1"
                max="100"
                step="0.1"
                value={formData.maxFileSizeGB}
                onChange={(e) => {
                  const value = parseFloat(e.target.value)
                  setFormData({ ...formData, maxFileSizeGB: isNaN(value) ? 0 : value })
                  if (errors.maxFileSizeGB) {
                    setErrors({ ...errors, maxFileSizeGB: undefined })
                  }
                }}
                className={`glass-card border-border/50 text-foreground ${
                  errors.maxFileSizeGB ? "border-destructive" : ""
                }`}
              />
              {errors.maxFileSizeGB && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.maxFileSizeGB}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Maximum size for a single file upload. Range: 0.1 GB - 100 GB
              </p>
              {settings && (
                <p className="text-xs text-muted-foreground">
                  Current: {formatBytes(settings.maxFileSize)}
                </p>
              )}
            </div>

            {/* Chunk Size */}
            <div className="space-y-2">
              <Label htmlFor="chunkSize" className="text-foreground">
                Chunk Size (MB)
              </Label>
              <Input
                id="chunkSize"
                type="number"
                min="1"
                max="100"
                step="1"
                value={formData.chunkSizeMB}
                onChange={(e) => {
                  const value = parseFloat(e.target.value)
                  setFormData({ ...formData, chunkSizeMB: isNaN(value) ? 0 : value })
                  if (errors.chunkSizeMB) {
                    setErrors({ ...errors, chunkSizeMB: undefined })
                  }
                }}
                className={`glass-card border-border/50 text-foreground ${
                  errors.chunkSizeMB ? "border-destructive" : ""
                }`}
              />
              {errors.chunkSizeMB && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.chunkSizeMB}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Size of each chunk for large file uploads. Range: 1 MB - 100 MB. Should be at most 10% of max file
                size.
              </p>
              {settings && (
                <p className="text-xs text-muted-foreground">
                  Current: {formatBytes(settings.chunkSize)}
                </p>
              )}
            </div>

            {/* Max Concurrent Chunks */}
            <div className="space-y-2">
              <Label htmlFor="maxConcurrentChunks" className="text-foreground">
                Max Concurrent Chunks
              </Label>
              <Input
                id="maxConcurrentChunks"
                type="number"
                min="1"
                max="10"
                step="1"
                value={formData.maxConcurrentChunks}
                onChange={(e) => {
                  const value = parseInt(e.target.value)
                  setFormData({ ...formData, maxConcurrentChunks: isNaN(value) ? 1 : value })
                  if (errors.maxConcurrentChunks) {
                    setErrors({ ...errors, maxConcurrentChunks: undefined })
                  }
                }}
                className={`glass-card border-border/50 text-foreground ${
                  errors.maxConcurrentChunks ? "border-destructive" : ""
                }`}
              />
              {errors.maxConcurrentChunks && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.maxConcurrentChunks}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Number of chunks uploaded simultaneously. Range: 1 - 10. Higher values may increase upload speed but
                also network load.
              </p>
              {settings && (
                <p className="text-xs text-muted-foreground">
                  Current: {settings.maxConcurrentChunks}
                </p>
              )}
            </div>

            {/* Parameter upload via API key */}
            <div className="rounded-lg border-2 border-amber-500/30 bg-amber-500/10 p-4 space-y-4">
              <p className="text-sm text-foreground font-medium">
                Parameter upload via API key
              </p>
              <p className="text-xs text-muted-foreground">
                Parameter berikut hanya berlaku untuk upload via API key. Ketiga nilai di bawah adalah nilai yang disarankan.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="apiConcurrency" className="text-foreground">
                    API concurrency
                  </Label>
                  <Input
                    id="apiConcurrency"
                    type="number"
                    min={1}
                    max={10}
                    step={1}
                    value={formData.apiConcurrency}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10)
                      setFormData({ ...formData, apiConcurrency: isNaN(value) ? 1 : value })
                      if (errors.apiConcurrency) setErrors({ ...errors, apiConcurrency: undefined })
                    }}
                    className={`glass-card border-border/50 text-foreground ${errors.apiConcurrency ? "border-destructive" : ""}`}
                  />
                  {errors.apiConcurrency && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.apiConcurrency}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Max concurrent API upload jobs. Recommended: 2</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tempCleanupHours" className="text-foreground">
                    Temp cleanup (hours)
                  </Label>
                  <Input
                    id="tempCleanupHours"
                    type="number"
                    min={1}
                    max={168}
                    step={1}
                    value={formData.tempCleanupHours}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10)
                      setFormData({ ...formData, tempCleanupHours: isNaN(value) ? 24 : value })
                      if (errors.tempCleanupHours) setErrors({ ...errors, tempCleanupHours: undefined })
                    }}
                    className={`glass-card border-border/50 text-foreground ${errors.tempCleanupHours ? "border-destructive" : ""}`}
                  />
                  {errors.tempCleanupHours && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.tempCleanupHours}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Remove orphan temp files after (hours). Recommended: 24</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiMaxDurationSeconds" className="text-foreground">
                    API max duration (s)
                  </Label>
                  <Input
                    id="apiMaxDurationSeconds"
                    type="number"
                    min={60}
                    max={86400}
                    step={60}
                    value={formData.apiMaxDurationSeconds}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10)
                      setFormData({ ...formData, apiMaxDurationSeconds: isNaN(value) ? 300 : value })
                      if (errors.apiMaxDurationSeconds) setErrors({ ...errors, apiMaxDurationSeconds: undefined })
                    }}
                    className={`glass-card border-border/50 text-foreground ${errors.apiMaxDurationSeconds ? "border-destructive" : ""}`}
                  />
                  {errors.apiMaxDurationSeconds && (
                    <p className="text-sm text-destructive flex items-center gap-1">
                      <AlertCircle className="h-4 w-4" />
                      {errors.apiMaxDurationSeconds}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">Max request duration (display). Recommended: 300</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={handleReset}
                disabled={saving}
                variant="outline"
                className="glass-card border-border/50 text-foreground hover:bg-white/5"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
  )
}

function BatchConfigurationTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState<BatchSettings | null>(null)
  const [formData, setFormData] = useState<BatchFormData>({
    credentialsBatchSize: 1000,
    passwordStatsBatchSize: 500,
    filesBatchSize: 500,
    fileWriteParallelLimit: 10,
  })
  const [errors, setErrors] = useState<Partial<Record<keyof BatchFormData, string>>>({})

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/settings/batch")
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        
        setFormData({
          credentialsBatchSize: data.credentialsBatchSize,
          passwordStatsBatchSize: data.passwordStatsBatchSize,
          filesBatchSize: data.filesBatchSize,
          fileWriteParallelLimit: data.fileWriteParallelLimit,
        })
      } else {
        throw new Error("Failed to load settings")
      }
    } catch (error) {
      console.error("Error loading batch settings:", error)
      toast({
        title: "Error",
        description: "Failed to load batch settings. Using defaults.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof BatchFormData, string>> = {}

    // Validate batch sizes (10 - 10000)
    if (formData.credentialsBatchSize < 10 || formData.credentialsBatchSize > 10000) {
      newErrors.credentialsBatchSize = "Credentials batch size must be between 10 and 10000"
    }

    if (formData.passwordStatsBatchSize < 10 || formData.passwordStatsBatchSize > 10000) {
      newErrors.passwordStatsBatchSize = "Password stats batch size must be between 10 and 10000"
    }

    if (formData.filesBatchSize < 10 || formData.filesBatchSize > 10000) {
      newErrors.filesBatchSize = "Files batch size must be between 10 and 10000"
    }

    // Validate parallel limit (1 - 50)
    if (formData.fileWriteParallelLimit < 1 || formData.fileWriteParallelLimit > 50) {
      newErrors.fileWriteParallelLimit = "File write parallel limit must be between 1 and 50"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSave = async () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors before saving.",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)

      // Update settings
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          settings: [
            {
              key_name: "db_batch_size_credentials",
              value: formData.credentialsBatchSize.toString(),
            },
            {
              key_name: "db_batch_size_password_stats",
              value: formData.passwordStatsBatchSize.toString(),
            },
            {
              key_name: "db_batch_size_files",
              value: formData.filesBatchSize.toString(),
            },
            {
              key_name: "file_write_parallel_limit",
              value: formData.fileWriteParallelLimit.toString(),
            },
          ],
        }),
      })

      if (response.ok) {
        const result = await response.json()
        toast({
          title: "Success",
          description: result.message || "Batch settings saved successfully",
        })
        
        // Reload settings
        await loadSettings()
      } else {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to save settings")
      }
    } catch (error) {
      console.error("Error saving batch settings:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save batch settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (settings) {
      setFormData({
        credentialsBatchSize: settings.credentialsBatchSize,
        passwordStatsBatchSize: settings.passwordStatsBatchSize,
        filesBatchSize: settings.filesBatchSize,
        fileWriteParallelLimit: settings.fileWriteParallelLimit,
      })
      setErrors({})
    }
  }

  if (loading) {
    return (
      <Card className="glass-card border-border/50">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading batch settings...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass-card border-border/50">
      <CardHeader>
        <CardTitle className="text-foreground">Database Batch Configuration</CardTitle>
        <CardDescription className="text-muted-foreground">
          Configure batch sizes for bulk database operations to optimize performance
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="rounded-lg border-2 border-blue-500/50 bg-blue-500/10 p-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-foreground font-medium leading-relaxed">
              These settings control how data is inserted into the database in batches. Larger batch sizes
              improve performance but use more memory. Adjust based on your system resources.
            </p>
          </div>
        </div>

        {/* Credentials Batch Size */}
        <div className="space-y-2">
          <Label htmlFor="credentialsBatchSize" className="text-foreground">
            Credentials Batch Size
          </Label>
          <Input
            id="credentialsBatchSize"
            type="number"
            min="10"
            max="10000"
            step="100"
            value={formData.credentialsBatchSize}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              setFormData({ ...formData, credentialsBatchSize: isNaN(value) ? 1000 : value })
              if (errors.credentialsBatchSize) {
                setErrors({ ...errors, credentialsBatchSize: undefined })
              }
            }}
            className={`glass-card border-border/50 text-foreground ${
              errors.credentialsBatchSize ? "border-destructive" : ""
            }`}
          />
          {errors.credentialsBatchSize && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.credentialsBatchSize}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Number of credentials inserted per batch. Range: 10 - 10000. Default: 1000
          </p>
          {settings && (
            <p className="text-xs text-muted-foreground">
              Current: {settings.credentialsBatchSize}
            </p>
          )}
        </div>

        {/* Password Stats Batch Size */}
        <div className="space-y-2">
          <Label htmlFor="passwordStatsBatchSize" className="text-foreground">
            Password Stats Batch Size
          </Label>
          <Input
            id="passwordStatsBatchSize"
            type="number"
            min="10"
            max="10000"
            step="50"
            value={formData.passwordStatsBatchSize}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              setFormData({ ...formData, passwordStatsBatchSize: isNaN(value) ? 500 : value })
              if (errors.passwordStatsBatchSize) {
                setErrors({ ...errors, passwordStatsBatchSize: undefined })
              }
            }}
            className={`glass-card border-border/50 text-foreground ${
              errors.passwordStatsBatchSize ? "border-destructive" : ""
            }`}
          />
          {errors.passwordStatsBatchSize && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.passwordStatsBatchSize}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Number of password stats inserted per batch. Range: 10 - 10000. Default: 500
          </p>
          {settings && (
            <p className="text-xs text-muted-foreground">
              Current: {settings.passwordStatsBatchSize}
            </p>
          )}
        </div>

        {/* Files Batch Size */}
        <div className="space-y-2">
          <Label htmlFor="filesBatchSize" className="text-foreground">
            Files Batch Size
          </Label>
          <Input
            id="filesBatchSize"
            type="number"
            min="10"
            max="10000"
            step="50"
            value={formData.filesBatchSize}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              setFormData({ ...formData, filesBatchSize: isNaN(value) ? 500 : value })
              if (errors.filesBatchSize) {
                setErrors({ ...errors, filesBatchSize: undefined })
              }
            }}
            className={`glass-card border-border/50 text-foreground ${
              errors.filesBatchSize ? "border-destructive" : ""
            }`}
          />
          {errors.filesBatchSize && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.filesBatchSize}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Number of file records inserted per batch. Range: 10 - 10000. Default: 500
          </p>
          {settings && (
            <p className="text-xs text-muted-foreground">
              Current: {settings.filesBatchSize}
            </p>
          )}
        </div>

        {/* File Write Parallel Limit */}
        <div className="space-y-2">
          <Label htmlFor="fileWriteParallelLimit" className="text-foreground">
            File Write Parallel Limit
          </Label>
          <Input
            id="fileWriteParallelLimit"
            type="number"
            min="1"
            max="50"
            step="1"
            value={formData.fileWriteParallelLimit}
            onChange={(e) => {
              const value = parseInt(e.target.value)
              setFormData({ ...formData, fileWriteParallelLimit: isNaN(value) ? 10 : value })
              if (errors.fileWriteParallelLimit) {
                setErrors({ ...errors, fileWriteParallelLimit: undefined })
              }
            }}
            className={`glass-card border-border/50 text-foreground ${
              errors.fileWriteParallelLimit ? "border-destructive" : ""
            }`}
          />
          {errors.fileWriteParallelLimit && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {errors.fileWriteParallelLimit}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Maximum number of files written to disk simultaneously. Range: 1 - 50. Default: 10.
            Higher values may increase speed but also system load.
          </p>
          {settings && (
            <p className="text-xs text-muted-foreground">
              Current: {settings.fileWriteParallelLimit}
            </p>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary/90 text-white"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Save Changes"}
          </Button>
          <Button
            onClick={handleReset}
            disabled={saving}
            variant="outline"
            className="glass-card border-border/50 text-foreground hover:bg-white/5"
          >
            Reset
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Storage Configuration Tab — S3-Compatible Object Storage
// ============================================================

interface StorageSettings {
  storageType: string
  s3Endpoint: string
  s3Region: string
  s3Bucket: string
  s3AccessKey: string
  s3SecretKey: string
  s3PathStyle: boolean
  s3UseSSL: boolean
  migrationStatus: string
  migrationProgress: string
}

interface StorageFormData {
  storageType: string
  s3Endpoint: string
  s3Region: string
  s3Bucket: string
  s3AccessKey: string
  s3SecretKey: string
  s3PathStyle: boolean
  s3UseSSL: boolean
}

interface MigrationProgress {
  status: string
  totalFiles: number
  migratedFiles: number
  failedFiles: number
  totalSizeBytes: number
  migratedSizeBytes: number
  currentFile: string
  startedAt: string | null
  completedAt: string | null
  error: string | null
  speed: number
  estimatedTimeRemaining: number
}

interface MigrationLogEntry {
  timestamp: string
  type: "info" | "success" | "warning" | "error"
  message: string
}

function StorageConfigurationTab() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [settings, setSettings] = useState<StorageSettings | null>(null)
  const [formData, setFormData] = useState<StorageFormData>({
    storageType: "local",
    s3Endpoint: "",
    s3Region: "us-east-1",
    s3Bucket: "",
    s3AccessKey: "",
    s3SecretKey: "",
    s3PathStyle: true,
    s3UseSSL: true,
  })

  // Migration state
  const [showMigrationConfirm, setShowMigrationConfirm] = useState(false)
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null)
  const [migrationLogs, setMigrationLogs] = useState<MigrationLogEntry[]>([])
  const [isMigrating, setIsMigrating] = useState(false)
  const migrationPollRef = useRef<NodeJS.Timeout | null>(null)
  const logsEndRef = useRef<HTMLDivElement | null>(null)

  // Load settings on mount
  useEffect(() => {
    loadSettings()
  }, [])

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [migrationLogs])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (migrationPollRef.current) {
        clearInterval(migrationPollRef.current)
      }
    }
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const response = await fetch("/api/settings/storage")
      if (response.ok) {
        const data = await response.json()
        setSettings(data)
        setFormData({
          storageType: data.storageType || "local",
          s3Endpoint: data.s3Endpoint || "",
          s3Region: data.s3Region || "us-east-1",
          s3Bucket: data.s3Bucket || "",
          s3AccessKey: data.s3AccessKey || "",
          s3SecretKey: data.s3SecretKey || "",
          s3PathStyle: data.s3PathStyle !== false,
          s3UseSSL: data.s3UseSSL !== false,
        })

        // Check if migration is currently running
        if (data.migrationStatus === "migrating") {
          setIsMigrating(true)
          startPollingMigration()
        }
      }
    } catch (error) {
      console.error("Error loading storage settings:", error)
      toast({
        title: "Error",
        description: "Failed to load storage settings.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    // Don't allow changing storage type directly — only through migration
    try {
      setSaving(true)
      const response = await fetch("/api/settings/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Only save S3 config, not storageType (that's changed via migration)
          s3Endpoint: formData.s3Endpoint,
          s3Region: formData.s3Region,
          s3Bucket: formData.s3Bucket,
          s3AccessKey: formData.s3AccessKey,
          s3SecretKey: formData.s3SecretKey,
          s3PathStyle: formData.s3PathStyle,
          s3UseSSL: formData.s3UseSSL,
        }),
      })

      if (response.ok) {
        toast({ title: "Success", description: "Storage settings saved successfully" })
        await loadSettings()
        // Don't clear testResult — keep it so migration button stays enabled
      } else {
        const err = await response.json()
        throw new Error(err.error || "Failed to save")
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch("/api/settings/storage/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          s3Endpoint: formData.s3Endpoint,
          s3Region: formData.s3Region,
          s3Bucket: formData.s3Bucket,
          s3AccessKey: formData.s3AccessKey,
          s3SecretKey: formData.s3SecretKey,
          s3PathStyle: formData.s3PathStyle,
          s3UseSSL: formData.s3UseSSL,
        }),
      })

      const data = await response.json()
      setTestResult({ success: data.success, message: data.message })
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Connection test failed",
      })
    } finally {
      setTesting(false)
    }
  }

  const startPollingMigration = useCallback(() => {
    if (migrationPollRef.current) {
      clearInterval(migrationPollRef.current)
    }

    const poll = async () => {
      try {
        const response = await fetch("/api/settings/storage/migrate")
        if (response.ok) {
          const data = await response.json()
          setMigrationProgress(data.progress)
          if (data.logs && data.logs.length > 0) {
            setMigrationLogs(data.logs)
          }

          // Stop polling when migration is done
          if (data.progress.status === "completed" || data.progress.status === "failed") {
            setIsMigrating(false)
            if (migrationPollRef.current) {
              clearInterval(migrationPollRef.current)
              migrationPollRef.current = null
            }
            // Reload settings to reflect new storage type
            await loadSettings()
          }
        }
      } catch (error) {
        console.error("Error polling migration:", error)
      }
    }

    // Initial poll
    poll()
    // Poll every 2 seconds
    migrationPollRef.current = setInterval(poll, 2000)
  }, [])

  const handleStartMigration = async () => {
    setShowMigrationConfirm(false)
    setIsMigrating(true)
    setMigrationProgress(null)
    setMigrationLogs([])

    try {
      const response = await fetch("/api/settings/storage/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      })

      const data = await response.json()
      if (data.success) {
        toast({ title: "Migration Started", description: "File migration to S3 has started." })
        startPollingMigration()
      } else {
        throw new Error(data.error || "Failed to start migration")
      }
    } catch (error) {
      setIsMigrating(false)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start migration",
        variant: "destructive",
      })
    }
  }

  const handleAbortMigration = async () => {
    try {
      const response = await fetch("/api/settings/storage/migrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "abort" }),
      })

      const data = await response.json()
      if (data.success) {
        toast({ title: "Abort Requested", description: "Migration abort has been requested." })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to abort migration",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="p-6">
          <div className="text-center text-muted-foreground">Loading storage settings...</div>
        </CardContent>
      </Card>
    )
  }

  const isCurrentlyS3 = settings?.storageType === "s3"
  const s3FieldsVisible = true // Always show S3 config fields

  return (
    <div className="space-y-4">
      {/* Current Storage Status */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-base">Current Storage</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              isCurrentlyS3
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "bg-green-500/20 text-green-400 border border-green-500/30"
            }`}>
              <HardDrive className="h-4 w-4" />
              {isCurrentlyS3 ? "S3-Compatible Object Storage" : "Local Filesystem"}
            </div>
            {settings?.migrationStatus === "completed" && (
              <span className="text-xs text-muted-foreground">Migration completed</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* S3 Configuration */}
      {s3FieldsVisible && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-foreground">S3-Compatible Storage Configuration</CardTitle>
            <CardDescription className="text-muted-foreground">
              Configure connection to AWS S3, MinIO, or any S3-compatible object storage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border-2 border-blue-500/50 bg-blue-500/10 p-4">
              <div className="flex items-start gap-3">
                <Info className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground font-medium leading-relaxed">
                  Configure your S3-compatible storage endpoint. Supports AWS S3, MinIO, and any S3-compatible service.
                  Save the configuration first, then test the connection before migrating.
                </p>
              </div>
            </div>

            {/* Endpoint */}
            <div className="space-y-2">
              <Label htmlFor="s3Endpoint" className="text-foreground">Endpoint URL</Label>
              <Input
                id="s3Endpoint"
                placeholder="e.g., http://minio:9000 or https://s3.amazonaws.com"
                value={formData.s3Endpoint}
                onChange={(e) => setFormData({ ...formData, s3Endpoint: e.target.value })}
                className="glass-card border-border/50 text-foreground"
                disabled={isMigrating}
              />
              <p className="text-xs text-muted-foreground">
                For MinIO: http://hostname:9000 | For AWS S3: https://s3.amazonaws.com
              </p>
            </div>

            {/* Region */}
            <div className="space-y-2">
              <Label htmlFor="s3Region" className="text-foreground">Region</Label>
              <Input
                id="s3Region"
                placeholder="us-east-1"
                value={formData.s3Region}
                onChange={(e) => setFormData({ ...formData, s3Region: e.target.value })}
                className="glass-card border-border/50 text-foreground"
                disabled={isMigrating}
              />
            </div>

            {/* Bucket */}
            <div className="space-y-2">
              <Label htmlFor="s3Bucket" className="text-foreground">Bucket Name</Label>
              <Input
                id="s3Bucket"
                placeholder="bron-vault-storage"
                value={formData.s3Bucket}
                onChange={(e) => setFormData({ ...formData, s3Bucket: e.target.value })}
                className="glass-card border-border/50 text-foreground"
                disabled={isMigrating}
              />
            </div>

            {/* Access Key */}
            <div className="space-y-2">
              <Label htmlFor="s3AccessKey" className="text-foreground">Access Key</Label>
              <Input
                id="s3AccessKey"
                placeholder="Access Key ID"
                value={formData.s3AccessKey}
                onChange={(e) => setFormData({ ...formData, s3AccessKey: e.target.value })}
                className="glass-card border-border/50 text-foreground"
                disabled={isMigrating}
              />
            </div>

            {/* Secret Key */}
            <div className="space-y-2">
              <Label htmlFor="s3SecretKey" className="text-foreground">Secret Key</Label>
              <Input
                id="s3SecretKey"
                type="password"
                placeholder="Secret Access Key"
                value={formData.s3SecretKey}
                onChange={(e) => setFormData({ ...formData, s3SecretKey: e.target.value })}
                className="glass-card border-border/50 text-foreground"
                disabled={isMigrating}
              />
            </div>

            {/* Options row */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="s3PathStyle"
                  checked={formData.s3PathStyle}
                  onChange={(e) => setFormData({ ...formData, s3PathStyle: e.target.checked })}
                  className="rounded border-border/50"
                  disabled={isMigrating}
                />
                <Label htmlFor="s3PathStyle" className="text-foreground text-sm cursor-pointer">
                  Path-style access (required for MinIO)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="s3UseSSL"
                  checked={formData.s3UseSSL}
                  onChange={(e) => setFormData({ ...formData, s3UseSSL: e.target.checked })}
                  className="rounded border-border/50"
                  disabled={isMigrating}
                />
                <Label htmlFor="s3UseSSL" className="text-foreground text-sm cursor-pointer">
                  Use SSL/TLS
                </Label>
              </div>
            </div>

            {/* Test Result */}
            {testResult && (
              <div className={`rounded-lg border-2 p-4 ${
                testResult.success
                  ? "border-green-500/50 bg-green-500/10"
                  : "border-destructive/50 bg-destructive/10"
              }`}>
                <div className="flex items-start gap-3">
                  {testResult.success ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm text-foreground font-medium">{testResult.message}</p>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={saving || isMigrating}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Configuration"}
              </Button>
              <Button
                onClick={handleTestConnection}
                disabled={testing || isMigrating || !formData.s3Endpoint || !formData.s3Bucket}
                variant="outline"
                className="glass-card border-border/50 text-foreground hover:bg-white/5"
              >
                {testing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Testing...
                  </>
                ) : (
                  "Test Connection"
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Migration Section */}
      {!isCurrentlyS3 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-foreground">Migrate to Object Storage</CardTitle>
            <CardDescription className="text-muted-foreground">
              Migrate all existing files from local filesystem to S3-compatible object storage
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Migration Warning */}
            {!isMigrating && !showMigrationConfirm && (
              <>
                <Alert className="border-amber-500/30 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-foreground">
                    <strong>Important:</strong> Migrating to S3 will transfer all locally stored files to your configured
                    object storage. After migration, S3 will become the single storage backend. Ensure your S3 configuration
                    is saved and the connection test passes before proceeding.
                  </AlertDescription>
                </Alert>
                <Button
                  onClick={() => setShowMigrationConfirm(true)}
                  disabled={!formData.s3Endpoint || !formData.s3Bucket || !testResult?.success}
                  variant="outline"
                  className="glass-card border-amber-500/50 text-amber-400 hover:bg-amber-500/10"
                >
                  <HardDrive className="mr-2 h-4 w-4" />
                  Start Migration to S3
                </Button>
                {(!formData.s3Endpoint || !formData.s3Bucket || !testResult?.success) && (
                  <p className="text-xs text-muted-foreground">
                    Save S3 configuration and test the connection first before starting migration.
                  </p>
                )}
              </>
            )}

            {/* Migration Confirmation Dialog */}
            {showMigrationConfirm && !isMigrating && (
              <div className="rounded-lg border-2 border-destructive/50 bg-destructive/10 p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-foreground font-semibold text-lg">Confirm Migration</h4>
                    <p className="text-muted-foreground mt-2 text-sm">
                      All files currently stored locally will be migrated to your S3-compatible object storage.
                      This process will:
                    </p>
                    <ul className="list-disc list-inside text-muted-foreground text-sm mt-2 space-y-1">
                      <li>Upload all extracted files to the S3 bucket</li>
                      <li>Verify each file after upload</li>
                      <li>Switch storage backend to S3 upon successful completion</li>
                      <li>New uploads will go directly to S3</li>
                    </ul>
                    <p className="text-amber-400 text-sm mt-3 font-medium">
                      Upload of new data will be temporarily suspended during migration.
                    </p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button
                    onClick={handleStartMigration}
                    className="bg-destructive hover:bg-destructive/90 text-white"
                  >
                    <HardDrive className="mr-2 h-4 w-4" />
                    Yes, Start Migration
                  </Button>
                  <Button
                    onClick={() => setShowMigrationConfirm(false)}
                    variant="outline"
                    className="glass-card border-border/50 text-foreground hover:bg-white/5"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            {/* Migration Progress */}
            {isMigrating && migrationProgress && (
              <div className="space-y-4">
                <div className="rounded-lg border-2 border-blue-500/50 bg-blue-500/10 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                      <span className="text-foreground font-medium">Migration in Progress</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {migrationProgress.totalFiles > 0
                        ? `${Math.round(
                            ((migrationProgress.migratedFiles + migrationProgress.failedFiles) /
                              migrationProgress.totalFiles) *
                              100
                          )}%`
                        : "0%"}
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-border/30 rounded-full h-3 mb-3">
                    <div
                      className="bg-blue-500 h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${
                          migrationProgress.totalFiles > 0
                            ? ((migrationProgress.migratedFiles + migrationProgress.failedFiles) /
                                migrationProgress.totalFiles) *
                              100
                            : 0
                        }%`,
                      }}
                    />
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Files</p>
                      <p className="text-foreground font-medium">
                        {migrationProgress.migratedFiles} / {migrationProgress.totalFiles}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Data</p>
                      <p className="text-foreground font-medium">
                        {formatBytes(migrationProgress.migratedSizeBytes)} /{" "}
                        {formatBytes(migrationProgress.totalSizeBytes)}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Speed</p>
                      <p className="text-foreground font-medium">
                        {migrationProgress.speed > 0
                          ? `${formatBytes(migrationProgress.speed)}/s`
                          : "Calculating..."}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">ETA</p>
                      <p className="text-foreground font-medium">
                        {migrationProgress.estimatedTimeRemaining > 0
                          ? formatDuration(migrationProgress.estimatedTimeRemaining)
                          : "Calculating..."}
                      </p>
                    </div>
                  </div>

                  {migrationProgress.failedFiles > 0 && (
                    <p className="text-destructive text-sm mt-2">
                      {migrationProgress.failedFiles} file(s) failed
                    </p>
                  )}

                  {migrationProgress.currentFile && (
                    <p className="text-muted-foreground text-xs mt-2 truncate">
                      Current: {migrationProgress.currentFile}
                    </p>
                  )}
                </div>

                {/* Abort Button */}
                <Button
                  onClick={handleAbortMigration}
                  variant="outline"
                  className="glass-card border-destructive/50 text-destructive hover:bg-destructive/10"
                >
                  Abort Migration
                </Button>
              </div>
            )}

            {/* Migration Completed */}
            {migrationProgress && migrationProgress.status === "completed" && !isMigrating && (
              <div className="rounded-lg border-2 border-green-500/50 bg-green-500/10 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground font-medium">Migration Completed Successfully!</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      {migrationProgress.migratedFiles} files ({formatBytes(migrationProgress.migratedSizeBytes)})
                      have been migrated to S3. All new uploads will now go to object storage.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Migration Failed */}
            {migrationProgress && migrationProgress.status === "failed" && !isMigrating && (
              <div className="rounded-lg border-2 border-destructive/50 bg-destructive/10 p-4">
                <div className="flex items-start gap-3">
                  <XCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-foreground font-medium">Migration Failed</p>
                    <p className="text-muted-foreground text-sm mt-1">
                      {migrationProgress.error || "An error occurred during migration."}
                    </p>
                    <p className="text-muted-foreground text-sm">
                      {migrationProgress.migratedFiles} of {migrationProgress.totalFiles} files were migrated before the failure.
                      Storage type remains as &quot;Local&quot;.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Migration Logs */}
            {migrationLogs.length > 0 && (
              <div className="space-y-2">
                <Label className="text-foreground text-sm">Migration Logs</Label>
                <div className="bg-black/40 rounded-lg p-3 max-h-60 overflow-y-auto font-mono text-xs space-y-0.5">
                  {migrationLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`${
                        log.type === "error"
                          ? "text-red-400"
                          : log.type === "warning"
                          ? "text-amber-400"
                          : log.type === "success"
                          ? "text-green-400"
                          : "text-muted-foreground"
                      }`}
                    >
                      <span className="opacity-50">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>{" "}
                      {log.message}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Already on S3 */}
      {isCurrentlyS3 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-foreground">Object Storage Active</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border-2 border-green-500/50 bg-green-500/10 p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-foreground font-medium">S3-Compatible Object Storage is Active</p>
                  <p className="text-muted-foreground text-sm mt-1">
                    All files are being stored in your configured S3-compatible object storage.
                    You can update the S3 configuration above if needed (e.g., rotating credentials).
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper: Format duration in seconds to human-readable
function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
  const hours = Math.floor(seconds / 3600)
  const mins = Math.round((seconds % 3600) / 60)
  return `${hours}h ${mins}m`
}

