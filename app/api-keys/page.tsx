"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth, isAdmin as checkIsAdmin } from "@/hooks/useAuth"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Copy, Key, Plus, Trash2, RefreshCw, EyeOff, Code, ShieldAlert, AlertCircle, CheckCircle2, Zap, Clock, Shield, ExternalLink } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

interface ApiKey {
  id: number
  name: string
  keyPrefix: string
  role: "admin" | "analyst"
  rateLimit: number
  rateLimitWindow: number
  isActive: boolean
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
  userName?: string
  userEmail?: string
  userId?: number
}

export default function ApiKeysPage() {
  const { user: currentUser, loading: authLoading } = useAuth(true)
  const userIsAdmin = checkIsAdmin(currentUser)
  const { toast } = useToast()
  
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null)

  // Form state
  const [keyName, setKeyName] = useState("")
  const [keyRole, setKeyRole] = useState<"admin" | "analyst">("analyst")
  const [rateLimit, setRateLimit] = useState(100)
  const [rateLimitWindow, setRateLimitWindow] = useState(60)

  const fetchApiKeys = useCallback(async () => {
    try {
      setIsLoading(true)
      const response = await fetch("/api/v1/api-keys", {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setApiKeys(data.data.apiKeys || [])
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to fetch API keys"
        })
      }
    } catch (error) {
      console.error("Error fetching API keys:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error loading API keys"
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!authLoading && currentUser) {
      fetchApiKeys()
    }
  }, [authLoading, currentUser, fetchApiKeys])

  const handleCreateKey = async () => {
    if (!keyName.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please enter a name for the API key"
      })
      return
    }

    try {
      setIsCreating(true)
      const response = await fetch("/api/v1/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({
          name: keyName.trim(),
          role: keyRole,
          rateLimit,
          rateLimitWindow,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setNewKeyRevealed(data.data.apiKey)
        toast({
          title: "Success",
          description: "API key created successfully"
        })
        fetchApiKeys()
        setShowCreateDialog(false)
        // Reset form
        setKeyName("")
        setKeyRole("analyst")
        setRateLimit(100)
        setRateLimitWindow(60)
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to create API key"
        })
      }
    } catch (error) {
      console.error("Error creating API key:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error creating API key"
      })
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteKey = async (keyId: number) => {
    if (!confirm("Are you sure you want to delete this API key? This action cannot be undone.")) {
      return
    }

    try {
      const response = await fetch(`/api/v1/api-keys/${keyId}`, {
        method: "DELETE",
        credentials: 'include',
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Success",
          description: "API key deleted"
        })
        fetchApiKeys()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to delete API key"
        })
      }
    } catch (error) {
      console.error("Error deleting API key:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error deleting API key"
      })
    }
  }

  const handleToggleActive = async (keyId: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/v1/api-keys/${keyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: 'include',
        body: JSON.stringify({ isActive }),
      })

      const data = await response.json()

      if (data.success) {
        toast({
          title: "Success",
          description: isActive ? "API key activated" : "API key deactivated"
        })
        fetchApiKeys()
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to update API key"
        })
      }
    } catch (error) {
      console.error("Error updating API key:", error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Error updating API key"
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Copied to clipboard"
    })
  }

  const formatDate = (date: string | null) => {
    if (!date) return "Never"
    return new Date(date).toLocaleString()
  }

  // Show loading while checking auth
  if (authLoading) {
    return (
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Checking permissions...</p>
          </div>
        </div>
      </main>
    )
  }

  // Access denied for non-logged in users
  if (!currentUser) {
    return (
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-6xl mx-auto space-y-6">
          <Card className="glass-card border-destructive/30">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <ShieldAlert className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Access Denied</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    You need to be logged in to manage API keys
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-destructive/20 bg-destructive/5">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-foreground">
                  <strong>Authentication Required:</strong> Please login to access this page.
                </AlertDescription>
              </Alert>
              <div className="pt-2">
                <Button variant="outline" onClick={() => window.location.href = '/login'} className="glass-card border-border/50">
                  Go to Login
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
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <Key className="h-7 w-7 text-primary" />
              </div>
              API Keys
            </h1>
            <p className="text-muted-foreground mt-2">Manage API keys for external integrations</p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={fetchApiKeys} variant="outline" size="sm" disabled={isLoading} className="glass-card border-border/50">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              onClick={() => setShowCreateDialog(true)}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create API Key
            </Button>
          </div>
        </div>

        {/* New Key Revealed - Professional Design */}
        {newKeyRevealed && (
          <Card className="glass-card border-emerald-500/30 bg-emerald-500/5">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <CardTitle className="text-foreground text-lg">API Key Created Successfully</CardTitle>
                  <CardDescription className="text-emerald-500/80">
                    Copy this key now - it will only be shown once!
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative">
                <div className="flex items-center gap-2 p-4 rounded-lg bg-background/50 border border-emerald-500/20">
                  <code className="flex-1 font-mono text-sm text-foreground break-all select-all">
                    {newKeyRevealed}
                  </code>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => copyToClipboard(newKeyRevealed)}
                      className="h-8 w-8 p-0 hover:bg-emerald-500/10 hover:text-emerald-500"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setNewKeyRevealed(null)}
                      className="h-8 w-8 p-0 hover:bg-muted"
                    >
                      <EyeOff className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <Alert className="border-amber-500/20 bg-amber-500/5">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-muted-foreground text-sm">
                  Store this key securely. For security reasons, you will not be able to view it again.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        )}

        {/* API Keys Table */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-foreground">Your API Keys</CardTitle>
                <CardDescription className="text-muted-foreground">
                  {userIsAdmin ? "View and manage all API keys" : "Manage your API keys"}
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {apiKeys.length} {apiKeys.length === 1 ? 'key' : 'keys'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : apiKeys.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <div className="p-4 rounded-full bg-muted/50 mb-4">
                  <Key className="h-10 w-10 opacity-50" />
                </div>
                <p className="font-medium text-foreground">No API keys yet</p>
                <p className="text-sm mt-1">Create your first API key to get started with the API</p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="sm"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create API Key
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-muted-foreground">Name</TableHead>
                      <TableHead className="text-muted-foreground">Key Prefix</TableHead>
                      <TableHead className="text-muted-foreground">Role</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground">Rate Limit</TableHead>
                      <TableHead className="text-muted-foreground">Last Used</TableHead>
                      {userIsAdmin && <TableHead className="text-muted-foreground">Owner</TableHead>}
                      <TableHead className="text-muted-foreground text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {apiKeys.map((key) => (
                      <TableRow key={key.id} className="border-border/50">
                        <TableCell className="font-medium text-foreground">{key.name}</TableCell>
                        <TableCell>
                          <code className="text-xs bg-muted/50 px-2 py-1 rounded font-mono">
                            {key.keyPrefix}...
                          </code>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={`text-xs ${
                              key.role === "admin" 
                                ? 'bg-primary/10 text-primary border-primary/30' 
                                : 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                            }`}
                          >
                            {key.role === "admin" ? (
                              <><Shield className="h-3 w-3 mr-1" /> Admin</>
                            ) : (
                              <><Zap className="h-3 w-3 mr-1" /> Analyst</>
                            )}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={key.isActive}
                              onCheckedChange={(checked) => handleToggleActive(key.id, checked)}
                              className="data-[state=checked]:bg-emerald-500"
                            />
                            <span className={`text-xs ${key.isActive ? 'text-emerald-500' : 'text-muted-foreground'}`}>
                              {key.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {key.rateLimit}/{key.rateLimitWindow}s
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(key.lastUsedAt)}
                        </TableCell>
                        {userIsAdmin && (
                          <TableCell className="text-xs text-muted-foreground">
                            {key.userName || key.userEmail || `User #${key.userId}`}
                          </TableCell>
                        )}
                        <TableCell className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteKey(key.id)}
                            className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Start Guide - Redesigned */}
        <Card className="glass-card border-border/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Code className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-foreground">Quick Start</CardTitle>
                  <CardDescription className="text-muted-foreground">How to use your API key</CardDescription>
                </div>
              </div>
              <Link href="/docs">
                <Button variant="outline" size="sm" className="glass-card border-border/50">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Full Documentation
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h4 className="font-medium mb-3 text-foreground flex items-center gap-2">
                <Badge variant="outline" className="text-xs">1</Badge>
                Authentication
              </h4>
              <p className="text-sm text-muted-foreground mb-3">
                Include your API key in the <code className="bg-muted/50 px-1.5 py-0.5 rounded text-xs">X-API-Key</code> header:
              </p>
              <div className="relative group">
                <pre className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm overflow-x-auto font-mono">
{`curl -H "X-API-Key: bv_your_api_key_here" \\
     https://your-domain.com/api/v1/search/credentials`}
                </pre>
                <Button
                  size="icon"
                  variant="ghost"
                  className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => copyToClipboard(`curl -H "X-API-Key: bv_your_api_key_here" \\
     https://your-domain.com/api/v1/search/credentials`)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div>
              <h4 className="font-medium mb-3 text-foreground flex items-center gap-2">
                <Badge variant="outline" className="text-xs">2</Badge>
                Available Endpoints
              </h4>
              <div className="grid gap-2">
                {[
                  { method: "POST", path: "/api/v1/search/credentials", desc: "Search credentials" },
                  { method: "POST", path: "/api/v1/search/domain", desc: "Search by domain" },
                  { method: "POST", path: "/api/v1/search/bulk", desc: "Bulk search" },
                  { method: "GET", path: "/api/v1/lookup?email=...", desc: "Quick email lookup" },
                  { method: "GET", path: "/api/v1/lookup?domain=...", desc: "Quick domain lookup" },
                  { method: "POST", path: "/api/v1/upload", desc: "Upload stealer logs", admin: true },
                ].map((endpoint, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/30">
                    <Badge 
                      variant="outline" 
                      className={`text-xs font-mono shrink-0 ${
                        endpoint.method === "GET" 
                          ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" 
                          : "bg-blue-500/10 text-blue-400 border-blue-500/30"
                      }`}
                    >
                      {endpoint.method}
                    </Badge>
                    <code className="text-xs font-mono text-foreground flex-1 truncate">{endpoint.path}</code>
                    <span className="text-xs text-muted-foreground shrink-0">{endpoint.desc}</span>
                    {endpoint.admin && (
                      <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-500 border-amber-500/30 shrink-0">
                        Admin
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Create Dialog - Redesigned */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="glass-modal sm:max-w-md border-border/50">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Key className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-foreground">Create New API Key</DialogTitle>
                  <DialogDescription className="text-muted-foreground">
                    Generate a new API key for external access
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-foreground">Name</Label>
                <Input
                  id="name"
                  placeholder="e.g. My Integration, SIEM Connector"
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  className="glass-card border-border/50"
                />
                <p className="text-xs text-muted-foreground">A descriptive name to identify this key</p>
              </div>
              
              <div className="space-y-2">
                <Label className="text-foreground">Role</Label>
                <Select value={keyRole} onValueChange={(v) => setKeyRole(v as "admin" | "analyst")}>
                  <SelectTrigger className="glass-card border-border/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="glass-modal border-border/50">
                    <SelectItem value="analyst">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-blue-400" />
                        <span>Analyst (Read-only)</span>
                      </div>
                    </SelectItem>
                    {userIsAdmin && (
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4 text-primary" />
                          <span>Admin (Full access)</span>
                        </div>
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {keyRole === "admin" 
                    ? "Can upload data and access all endpoints" 
                    : "Can only search and read data"}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Rate Limit</Label>
                  <Input
                    type="number"
                    min={1}
                    max={10000}
                    value={rateLimit}
                    onChange={(e) => setRateLimit(Number(e.target.value))}
                    className="glass-card border-border/50"
                  />
                  <p className="text-xs text-muted-foreground">Requests per window</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Window (seconds)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={3600}
                    value={rateLimitWindow}
                    onChange={(e) => setRateLimitWindow(Number(e.target.value))}
                    className="glass-card border-border/50"
                  />
                  <p className="text-xs text-muted-foreground">Time window in seconds</p>
                </div>
              </div>

              <Alert className="border-border/30 bg-muted/20">
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
                <AlertDescription className="text-xs text-muted-foreground">
                  The API key will only be shown once after creation. Make sure to copy and store it securely.
                </AlertDescription>
              </Alert>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)} className="glass-card border-border/50">
                Cancel
              </Button>
              <Button onClick={handleCreateKey} disabled={isCreating} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                {isCreating ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Key
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
