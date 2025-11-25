"use client"

import { useState, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Settings, Save, AlertCircle, Info, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useToast } from "@/hooks/use-toast"
import { formatBytes } from "@/lib/utils"

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

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  
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

  return (
    <main className="flex-1 p-6 bg-bron-bg-primary">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-bron-text-primary flex items-center gap-2">
            <Settings className="h-8 w-8" />
            Settings
          </h1>
          <p className="text-bron-text-muted mt-2">Configure application settings</p>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="inline-flex w-full bg-bron-bg-tertiary border border-bron-border">
            <TabsTrigger
              value="upload"
              className="text-sm font-normal data-[state=active]:bg-bron-accent-red data-[state=active]:text-white flex-1"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Configuration
            </TabsTrigger>
            {/* Future tabs can be added here */}
            {/* Example:
            <TabsTrigger
              value="api"
              className="text-sm font-normal data-[state=active]:bg-bron-accent-red data-[state=active]:text-white flex-1"
            >
              <Key className="h-4 w-4 mr-2" />
              API Configuration
            </TabsTrigger>
            */}
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <UploadConfigurationTab />
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
      <Card className="bg-bron-bg-tertiary border-bron-border">
        <CardContent className="p-6">
          <div className="text-center text-bron-text-muted">Loading settings...</div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="bg-bron-bg-tertiary border-bron-border">
      <CardHeader>
        <CardTitle className="text-bron-text-primary">Upload Configuration</CardTitle>
        <CardDescription className="text-bron-text-muted">
          Configure file upload limits and chunking behavior for large file uploads
        </CardDescription>
      </CardHeader>
          <CardContent className="space-y-6">
            <Alert className="bg-bron-accent-blue/10 border-bron-accent-blue/30">
              <Info className="h-4 w-4 text-bron-accent-blue" />
              <AlertDescription className="text-bron-text-primary">
                These settings control how large files are uploaded. Files larger than 100MB will be automatically
                split into chunks for efficient upload.
              </AlertDescription>
            </Alert>

            {/* Max File Size */}
            <div className="space-y-2">
              <Label htmlFor="maxFileSize" className="text-bron-text-primary">
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
                className={`bg-bron-bg-secondary border-bron-border text-bron-text-primary ${
                  errors.maxFileSizeGB ? "border-bron-accent-red" : ""
                }`}
              />
              {errors.maxFileSizeGB && (
                <p className="text-sm text-bron-accent-red flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.maxFileSizeGB}
                </p>
              )}
              <p className="text-xs text-bron-text-muted">
                Maximum size for a single file upload. Range: 0.1 GB - 100 GB
              </p>
              {settings && (
                <p className="text-xs text-bron-text-muted">
                  Current: {formatBytes(settings.maxFileSize)}
                </p>
              )}
            </div>

            {/* Chunk Size */}
            <div className="space-y-2">
              <Label htmlFor="chunkSize" className="text-bron-text-primary">
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
                className={`bg-bron-bg-secondary border-bron-border text-bron-text-primary ${
                  errors.chunkSizeMB ? "border-bron-accent-red" : ""
                }`}
              />
              {errors.chunkSizeMB && (
                <p className="text-sm text-bron-accent-red flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.chunkSizeMB}
                </p>
              )}
              <p className="text-xs text-bron-text-muted">
                Size of each chunk for large file uploads. Range: 1 MB - 100 MB. Should be at most 10% of max file
                size.
              </p>
              {settings && (
                <p className="text-xs text-bron-text-muted">
                  Current: {formatBytes(settings.chunkSize)}
                </p>
              )}
            </div>

            {/* Max Concurrent Chunks */}
            <div className="space-y-2">
              <Label htmlFor="maxConcurrentChunks" className="text-bron-text-primary">
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
                className={`bg-bron-bg-secondary border-bron-border text-bron-text-primary ${
                  errors.maxConcurrentChunks ? "border-bron-accent-red" : ""
                }`}
              />
              {errors.maxConcurrentChunks && (
                <p className="text-sm text-bron-accent-red flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {errors.maxConcurrentChunks}
                </p>
              )}
              <p className="text-xs text-bron-text-muted">
                Number of chunks uploaded simultaneously. Range: 1 - 10. Higher values may increase upload speed but
                also network load.
              </p>
              {settings && (
                <p className="text-xs text-bron-text-muted">
                  Current: {settings.maxConcurrentChunks}
                </p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-bron-accent-red hover:bg-bron-accent-red-hover text-white"
              >
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                onClick={handleReset}
                disabled={saving}
                variant="outline"
                className="bg-bron-bg-secondary border-bron-border text-bron-text-primary hover:bg-bron-bg-tertiary"
              >
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>
  )
}

