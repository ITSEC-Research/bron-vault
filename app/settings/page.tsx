"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Settings, Save, AlertCircle, Info, Upload, Database, ShieldAlert } from "lucide-react"
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
}

interface SettingsFormData {
  maxFileSizeGB: number
  chunkSizeMB: number
  maxConcurrentChunks: number
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
          <TabsList className="items-center justify-center rounded-md p-1 text-muted-foreground grid w-full grid-cols-2 glass-card h-8">
            <TabsTrigger
              value="upload"
              className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <Upload className="h-3 w-3 mr-1" />
              Upload Configuration
            </TabsTrigger>
            <TabsTrigger
              value="batch"
              className="text-xs font-normal data-[state=active]:bg-primary data-[state=active]:text-primary-foreground px-2 py-1 hover:bg-white/5 hover:text-foreground transition-colors"
            >
              <Database className="h-3 w-3 mr-1" />
              Database Batch
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <UploadConfigurationTab />
          </TabsContent>

          <TabsContent value="batch" className="mt-4">
            <BatchConfigurationTab />
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

