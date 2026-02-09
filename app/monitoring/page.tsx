"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth, isAdmin as checkIsAdmin } from "@/hooks/useAuth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Radio, Webhook, Bell, Plus, Trash2, RefreshCw, Eye,
  CheckCircle2, XCircle, AlertCircle, Globe, Send, Pencil,
  Activity, Shield
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"

// ===================== TYPES =====================

interface DomainMonitor {
  id: number
  name: string
  domains: string[]
  match_mode: "credential" | "url" | "both"
  is_active: boolean
  webhook_count?: number
  webhooks?: MonitorWebhookItem[]
  last_triggered_at: string | null
  total_alerts: number
  created_at: string
}

interface MonitorWebhookItem {
  id: number
  name: string
  url: string
  url_full?: string
  secret: string | null
  headers: Record<string, string> | null
  is_active: boolean
  monitor_count?: number
  last_triggered_at: string | null
  created_at: string
}

interface MonitorAlertItem {
  id: number
  monitor_id: number
  webhook_id: number
  device_id: string | null
  upload_batch: string | null
  matched_domain: string
  match_type: "credential_email" | "url" | "both"
  credential_match_count: number
  url_match_count: number
  payload_sent: string | null
  status: "success" | "failed" | "retrying"
  http_status: number | null
  error_message: string | null
  retry_count: number
  created_at: string
  monitor_name?: string
  webhook_name?: string
}

interface MonitoringStats {
  monitors: { total: number; active: number }
  webhooks: { total: number; active: number }
  alerts: { total: number; today: number; success: number; failed: number }
}

// ===================== COMPONENT =====================

export default function MonitoringPage() {
  const { user, loading: authLoading } = useAuth(true)
  const userIsAdmin = checkIsAdmin(user)
  const { toast } = useToast()

  const [activeTab, setActiveTab] = useState("monitors")
  const [stats, setStats] = useState<MonitoringStats | null>(null)

  // Monitors state
  const [monitors, setMonitors] = useState<DomainMonitor[]>([])
  const [monitorsLoading, setMonitorsLoading] = useState(true)
  const [showMonitorDialog, setShowMonitorDialog] = useState(false)
  const [editingMonitor, setEditingMonitor] = useState<DomainMonitor | null>(null)
  const [monitorForm, setMonitorForm] = useState({
    name: "",
    domains: "",
    match_mode: "both" as "credential" | "url" | "both",
    webhook_ids: [] as number[],
  })

  // Webhooks state
  const [webhooks, setWebhooks] = useState<MonitorWebhookItem[]>([])
  const [webhooksLoading, setWebhooksLoading] = useState(true)
  const [showWebhookDialog, setShowWebhookDialog] = useState(false)
  const [editingWebhook, setEditingWebhook] = useState<MonitorWebhookItem | null>(null)
  const [webhookForm, setWebhookForm] = useState({
    name: "",
    url: "",
    secret: "",
    headers: "",
  })
  const [testingWebhook, setTestingWebhook] = useState<number | null>(null)

  // Alerts state
  const [alerts, setAlerts] = useState<MonitorAlertItem[]>([])
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [alertsTotal, setAlertsTotal] = useState(0)
  const [alertsPage, setAlertsPage] = useState(0)
  const [alertStatusFilter, setAlertStatusFilter] = useState<string>("all")
  const [viewPayload, setViewPayload] = useState<string | null>(null)

  // ===================== DATA FETCHING =====================

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch("/api/monitoring/stats", { credentials: "include", cache: "no-store" })
      const data = await res.json()
      if (data.success) setStats(data.data)
    } catch (error) {
      console.error("Error fetching stats:", error)
    }
  }, [])

  const fetchMonitors = useCallback(async () => {
    try {
      setMonitorsLoading(true)
      const res = await fetch("/api/monitoring/monitors", { credentials: "include", cache: "no-store" })
      const data = await res.json()
      if (data.success) {
        setMonitors(data.data || [])
      } else {
        console.error("API error listing monitors:", data.error)
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to fetch monitors" })
      }
    } catch (error) {
      console.error("Error fetching monitors:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch monitors" })
    } finally {
      setMonitorsLoading(false)
    }
  }, [toast])

  const fetchWebhooks = useCallback(async () => {
    try {
      setWebhooksLoading(true)
      const res = await fetch("/api/monitoring/webhooks", { credentials: "include", cache: "no-store" })
      const data = await res.json()
      if (data.success) {
        setWebhooks(data.data || [])
      } else {
        console.error("API error listing webhooks:", data.error)
        toast({ variant: "destructive", title: "Error", description: data.error || "Failed to fetch webhooks" })
      }
    } catch (error) {
      console.error("Error fetching webhooks:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch webhooks" })
    } finally {
      setWebhooksLoading(false)
    }
  }, [toast])

  const fetchAlerts = useCallback(async (page: number = 0, status?: string) => {
    try {
      setAlertsLoading(true)
      const params = new URLSearchParams()
      params.set("limit", "25")
      params.set("offset", String(page * 25))
      if (status && status !== "all") params.set("status", status)

      const res = await fetch(`/api/monitoring/alerts?${params}`, { credentials: "include", cache: "no-store" })
      const data = await res.json()
      if (data.success) {
        setAlerts(data.data || [])
        setAlertsTotal(data.total || 0)
      } else {
        console.error("API error listing alerts:", data.error)
      }
    } catch (error) {
      console.error("Error fetching alerts:", error)
      toast({ variant: "destructive", title: "Error", description: "Failed to fetch alerts" })
    } finally {
      setAlertsLoading(false)
    }
  }, [toast])

  useEffect(() => {
    if (!authLoading && user) {
      fetchStats()
      fetchMonitors()
      fetchWebhooks()
      fetchAlerts(0)
    }
  }, [authLoading, user, fetchStats, fetchMonitors, fetchWebhooks, fetchAlerts])

  // ===================== MONITOR HANDLERS =====================

  const openCreateMonitorDialog = () => {
    setEditingMonitor(null)
    setMonitorForm({ name: "", domains: "", match_mode: "both", webhook_ids: [] })
    setShowMonitorDialog(true)
  }

  const openEditMonitorDialog = async (monitor: DomainMonitor) => {
    // Fetch full monitor details with webhooks
    try {
      const res = await fetch(`/api/monitoring/monitors/${monitor.id}`, { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        const m = data.data
        setEditingMonitor(m)
        setMonitorForm({
          name: m.name,
          domains: m.domains.join("\n"),
          match_mode: m.match_mode,
          webhook_ids: m.webhooks?.map((w: MonitorWebhookItem) => w.id) || [],
        })
        setShowMonitorDialog(true)
      }
    } catch (_error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load monitor details" })
    }
  }

  const handleSaveMonitor = async () => {
    const domains = monitorForm.domains
      .split(/[\n,]/)
      .map(d => d.trim())
      .filter(d => d.length > 0)

    if (!monitorForm.name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Monitor name is required" })
      return
    }
    if (domains.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "At least one domain is required" })
      return
    }

    try {
      const body = {
        name: monitorForm.name.trim(),
        domains,
        match_mode: monitorForm.match_mode,
        webhook_ids: monitorForm.webhook_ids,
      }

      const url = editingMonitor
        ? `/api/monitoring/monitors/${editingMonitor.id}`
        : "/api/monitoring/monitors"

      const res = await fetch(url, {
        method: editingMonitor ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.success) {
        toast({ title: "Success", description: editingMonitor ? "Monitor updated" : "Monitor created" })
        setShowMonitorDialog(false)
        fetchMonitors()
        fetchStats()
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error })
      }
    } catch (_error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save monitor" })
    }
  }

  const handleToggleMonitor = async (monitor: DomainMonitor) => {
    try {
      const res = await fetch(`/api/monitoring/monitors/${monitor.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !monitor.is_active }),
      })
      const data = await res.json()
      if (data.success) {
        fetchMonitors()
        fetchStats()
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error })
      }
    } catch (_error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to toggle monitor" })
    }
  }

  const handleDeleteMonitor = async (monitor: DomainMonitor) => {
    if (!confirm(`Delete monitor "${monitor.name}"? This will also delete all associated alerts.`)) return

    try {
      const res = await fetch(`/api/monitoring/monitors/${monitor.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Success", description: "Monitor deleted" })
        fetchMonitors()
        fetchStats()
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error })
      }
    } catch (_error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete monitor" })
    }
  }

  // ===================== WEBHOOK HANDLERS =====================

  const openCreateWebhookDialog = () => {
    setEditingWebhook(null)
    setWebhookForm({ name: "", url: "", secret: "", headers: "" })
    setShowWebhookDialog(true)
  }

  const openEditWebhookDialog = async (webhook: MonitorWebhookItem) => {
    try {
      const res = await fetch(`/api/monitoring/webhooks/${webhook.id}`, { credentials: "include" })
      const data = await res.json()
      if (data.success) {
        const w = data.data
        setEditingWebhook(w)
        setWebhookForm({
          name: w.name,
          url: w.url,
          secret: w.secret || "",
          headers: w.headers ? JSON.stringify(w.headers, null, 2) : "",
        })
        setShowWebhookDialog(true)
      }
    } catch (_error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to load webhook details" })
    }
  }

  const handleSaveWebhook = async () => {
    if (!webhookForm.name.trim()) {
      toast({ variant: "destructive", title: "Error", description: "Webhook name is required" })
      return
    }
    if (!webhookForm.url.trim() || !webhookForm.url.startsWith("http")) {
      toast({ variant: "destructive", title: "Error", description: "Valid URL is required" })
      return
    }

    let headers = undefined
    if (webhookForm.headers.trim()) {
      try {
        headers = JSON.parse(webhookForm.headers)
      } catch {
        toast({ variant: "destructive", title: "Error", description: "Invalid JSON in headers" })
        return
      }
    }

    try {
      const body: Record<string, unknown> = {
        name: webhookForm.name.trim(),
        url: webhookForm.url.trim(),
        secret: webhookForm.secret || undefined,
        headers,
      }

      const url = editingWebhook
        ? `/api/monitoring/webhooks/${editingWebhook.id}`
        : "/api/monitoring/webhooks"

      const res = await fetch(url, {
        method: editingWebhook ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      })

      const data = await res.json()
      if (data.success) {
        toast({ title: "Success", description: editingWebhook ? "Webhook updated" : "Webhook created" })
        setShowWebhookDialog(false)
        fetchWebhooks()
        fetchStats()
      } else {
        toast({ variant: "destructive", title: "Error", description: data.error })
      }
    } catch (_error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to save webhook" })
    }
  }

  const handleTestWebhook = async (webhookId: number) => {
    setTestingWebhook(webhookId)
    try {
      const res = await fetch(`/api/monitoring/webhooks/${webhookId}/test`, {
        method: "POST",
        credentials: "include",
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Test Successful", description: data.message })
      } else {
        toast({ variant: "destructive", title: "Test Failed", description: data.message || data.error })
      }
    } catch (_error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to test webhook" })
    } finally {
      setTestingWebhook(null)
    }
  }

  const handleToggleWebhook = async (webhook: MonitorWebhookItem) => {
    try {
      const res = await fetch(`/api/monitoring/webhooks/${webhook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ is_active: !webhook.is_active }),
      })
      const data = await res.json()
      if (data.success) {
        fetchWebhooks()
        fetchStats()
      }
    } catch (_error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to toggle webhook" })
    }
  }

  const handleDeleteWebhook = async (webhook: MonitorWebhookItem) => {
    if (!confirm(`Delete webhook "${webhook.name}"? It will be removed from all monitors.`)) return

    try {
      const res = await fetch(`/api/monitoring/webhooks/${webhook.id}`, {
        method: "DELETE",
        credentials: "include",
      })
      const data = await res.json()
      if (data.success) {
        toast({ title: "Success", description: "Webhook deleted" })
        fetchWebhooks()
        fetchStats()
      }
    } catch (_error) {
      toast({ variant: "destructive", title: "Error", description: "Failed to delete webhook" })
    }
  }

  // ===================== RENDER =====================

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never"
    try {
      return new Date(dateStr).toLocaleString()
    } catch {
      return dateStr
    }
  }

  return (
    <div className="container mx-auto py-6 px-4 space-y-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Domain Monitoring</h1>
          <p className="text-muted-foreground">
            Monitor domains and receive webhook alerts when matches are found during uploads.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { fetchStats(); fetchMonitors(); fetchWebhooks(); fetchAlerts(alertsPage, alertStatusFilter) }}
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Monitors</p>
                  <p className="text-2xl font-bold">{stats.monitors.active}</p>
                </div>
                <Radio className="h-8 w-8 text-primary opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stats.monitors.total} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Webhooks</p>
                  <p className="text-2xl font-bold">{stats.webhooks.active}</p>
                </div>
                <Webhook className="h-8 w-8 text-blue-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stats.webhooks.total} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Alerts Today</p>
                  <p className="text-2xl font-bold">{stats.alerts.today}</p>
                </div>
                <Bell className="h-8 w-8 text-amber-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">{stats.alerts.total} total</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {stats.alerts.total > 0
                      ? Math.round((stats.alerts.success / stats.alerts.total) * 100)
                      : 100}%
                  </p>
                </div>
                <Activity className="h-8 w-8 text-green-500 opacity-50" />
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats.alerts.failed} failed
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tab Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="monitors" className="gap-2">
            <Radio className="h-4 w-4" />
            Monitors
          </TabsTrigger>
          <TabsTrigger value="webhooks" className="gap-2">
            <Webhook className="h-4 w-4" />
            Webhooks
          </TabsTrigger>
          <TabsTrigger value="alerts" className="gap-2">
            <Bell className="h-4 w-4" />
            Alert History
          </TabsTrigger>
        </TabsList>

        {/* ============ MONITORS TAB ============ */}
        <TabsContent value="monitors" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Define domains to monitor. When a match is found during upload, alerts are sent to linked webhooks.
            </p>
            {userIsAdmin && (
              <Button onClick={openCreateMonitorDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Monitor
              </Button>
            )}
          </div>

          {monitorsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : monitors.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Radio className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
                <p className="text-muted-foreground">No monitors configured yet.</p>
                {userIsAdmin && (
                  <Button onClick={openCreateMonitorDialog} variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first monitor
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {monitors.map(monitor => (
                <Card key={monitor.id} className={!monitor.is_active ? "opacity-60" : ""}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-lg">{monitor.name}</CardTitle>
                        <Badge variant={monitor.is_active ? "default" : "secondary"}>
                          {monitor.is_active ? "Active" : "Inactive"}
                        </Badge>
                        <Badge variant="outline">
                          {monitor.match_mode === "both" ? "Email + URL" : monitor.match_mode === "credential" ? "Email Only" : "URL Only"}
                        </Badge>
                      </div>
                      {userIsAdmin && (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={monitor.is_active}
                            onCheckedChange={() => handleToggleMonitor(monitor)}
                          />
                          <Button variant="ghost" size="icon" onClick={() => openEditMonitorDialog(monitor)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteMonitor(monitor)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {monitor.domains.map((domain, i) => (
                        <Badge key={i} variant="outline" className="gap-1">
                          <Globe className="h-3 w-3" />
                          {domain}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Webhook className="h-3.5 w-3.5" />
                        {monitor.webhook_count || 0} webhook{(monitor.webhook_count || 0) !== 1 ? "s" : ""}
                      </span>
                      <span className="flex items-center gap-1">
                        <Bell className="h-3.5 w-3.5" />
                        {monitor.total_alerts} alert{monitor.total_alerts !== 1 ? "s" : ""}
                      </span>
                      <span>Last triggered: {formatDate(monitor.last_triggered_at)}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ============ WEBHOOKS TAB ============ */}
        <TabsContent value="webhooks" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Webhook endpoints for receiving alert payloads. One webhook can be used by multiple monitors.
            </p>
            {userIsAdmin && (
              <Button onClick={openCreateWebhookDialog} size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            )}
          </div>

          {webhooksLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : webhooks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Webhook className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
                <p className="text-muted-foreground">No webhooks configured yet.</p>
                {userIsAdmin && (
                  <Button onClick={openCreateWebhookDialog} variant="outline" className="mt-4">
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first webhook
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>URL</TableHead>
                    <TableHead>Secret</TableHead>
                    <TableHead>Monitors</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Last Triggered</TableHead>
                    {userIsAdmin && <TableHead className="text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {webhooks.map(webhook => (
                    <TableRow key={webhook.id}>
                      <TableCell className="font-medium">{webhook.name}</TableCell>
                      <TableCell className="font-mono text-xs max-w-[200px] truncate">
                        {webhook.url}
                      </TableCell>
                      <TableCell>
                        {webhook.secret ? (
                          <Badge variant="outline" className="gap-1">
                            <Shield className="h-3 w-3" />
                            Configured
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">None</span>
                        )}
                      </TableCell>
                      <TableCell>{webhook.monitor_count || 0}</TableCell>
                      <TableCell>
                        <Badge variant={webhook.is_active ? "default" : "secondary"}>
                          {webhook.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDate(webhook.last_triggered_at)}
                      </TableCell>
                      {userIsAdmin && (
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleTestWebhook(webhook.id)}
                              disabled={testingWebhook === webhook.id}
                              title="Test webhook"
                            >
                              {testingWebhook === webhook.id ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                <Send className="h-4 w-4" />
                              )}
                            </Button>
                            <Switch
                              checked={webhook.is_active}
                              onCheckedChange={() => handleToggleWebhook(webhook)}
                              className="scale-75"
                            />
                            <Button variant="ghost" size="icon" onClick={() => openEditWebhookDialog(webhook)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteWebhook(webhook)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* ============ ALERTS TAB ============ */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              History of all webhook alerts sent by domain monitors.
            </p>
            <Select value={alertStatusFilter} onValueChange={(v) => { setAlertStatusFilter(v); setAlertsPage(0); fetchAlerts(0, v) }}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="retrying">Retrying</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {alertsLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : alerts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground opacity-30 mb-4" />
                <p className="text-muted-foreground">No alerts found.</p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Monitor</TableHead>
                      <TableHead>Matched Domain</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Hits</TableHead>
                      <TableHead>Webhook</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Payload</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map(alert => (
                      <TableRow key={alert.id}>
                        <TableCell className="text-xs whitespace-nowrap">
                          {formatDate(alert.created_at)}
                        </TableCell>
                        <TableCell className="font-medium">{alert.monitor_name || `#${alert.monitor_id}`}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="gap-1">
                            <Globe className="h-3 w-3" />
                            {alert.matched_domain}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {alert.match_type === "credential_email" ? "Email" : alert.match_type === "url" ? "URL" : "Both"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs">
                            {alert.credential_match_count > 0 && <span className="block">Cred: {alert.credential_match_count}</span>}
                            {alert.url_match_count > 0 && <span className="block">URL: {alert.url_match_count}</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{alert.webhook_name || `#${alert.webhook_id}`}</TableCell>
                        <TableCell>
                          {alert.status === "success" ? (
                            <Badge variant="default" className="gap-1 bg-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              {alert.http_status}
                            </Badge>
                          ) : alert.status === "failed" ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              {alert.http_status || "Error"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="gap-1 text-amber-500 border-amber-500">
                              <AlertCircle className="h-3 w-3" />
                              Retrying
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {alert.payload_sent && (
                            <Button variant="ghost" size="icon" onClick={() => setViewPayload(alert.payload_sent)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>

              {/* Pagination */}
              {alertsTotal > 25 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Showing {alertsPage * 25 + 1} - {Math.min((alertsPage + 1) * 25, alertsTotal)} of {alertsTotal}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={alertsPage === 0}
                      onClick={() => { setAlertsPage(p => p - 1); fetchAlerts(alertsPage - 1, alertStatusFilter) }}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={(alertsPage + 1) * 25 >= alertsTotal}
                      onClick={() => { setAlertsPage(p => p + 1); fetchAlerts(alertsPage + 1, alertStatusFilter) }}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ============ MONITOR CREATE/EDIT DIALOG ============ */}
      <Dialog open={showMonitorDialog} onOpenChange={setShowMonitorDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingMonitor ? "Edit Monitor" : "Create Monitor"}</DialogTitle>
            <DialogDescription>
              {editingMonitor
                ? "Update monitor configuration."
                : "Define domains to monitor and link webhooks for alerts."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="monitor-name">Monitor Name</Label>
              <Input
                id="monitor-name"
                value={monitorForm.name}
                onChange={e => setMonitorForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Banking Domains"
              />
            </div>

            <div>
              <Label htmlFor="monitor-domains">Domains (one per line or comma-separated)</Label>
              <Textarea
                id="monitor-domains"
                value={monitorForm.domains}
                onChange={e => setMonitorForm(f => ({ ...f, domains: e.target.value }))}
                placeholder={"example.com\nbank.co.id\nmail.example.org"}
                rows={4}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Subdomains are matched automatically (e.g. &quot;example.com&quot; also matches &quot;sub.example.com&quot;)
              </p>
            </div>

            <div>
              <Label>Match Mode</Label>
              <Select
                value={monitorForm.match_mode}
                onValueChange={v => setMonitorForm(f => ({ ...f, match_mode: v as "credential" | "url" | "both" }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">Both (Email + URL)</SelectItem>
                  <SelectItem value="credential">Email/Credential Only</SelectItem>
                  <SelectItem value="url">URL Only</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                &quot;Email&quot; matches credentials where login email uses the domain. &quot;URL&quot; matches credentials where the URL targets the domain.
              </p>
            </div>

            <div>
              <Label>Linked Webhooks</Label>
              {webhooks.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No webhooks available. Create a webhook first in the Webhooks tab.
                  </AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2 mt-2 max-h-40 overflow-auto">
                  {webhooks.filter(w => w.is_active).map(wh => (
                    <label key={wh.id} className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={monitorForm.webhook_ids.includes(wh.id)}
                        onChange={e => {
                          setMonitorForm(f => ({
                            ...f,
                            webhook_ids: e.target.checked
                              ? [...f.webhook_ids, wh.id]
                              : f.webhook_ids.filter(id => id !== wh.id)
                          }))
                        }}
                        className="rounded"
                      />
                      <span className="font-medium text-sm">{wh.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{wh.url}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMonitorDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveMonitor}>
              {editingMonitor ? "Update" : "Create"} Monitor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ WEBHOOK CREATE/EDIT DIALOG ============ */}
      <Dialog open={showWebhookDialog} onOpenChange={setShowWebhookDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingWebhook ? "Edit Webhook" : "Create Webhook"}</DialogTitle>
            <DialogDescription>
              Configure a webhook endpoint to receive domain monitoring alerts.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="webhook-name">Webhook Name</Label>
              <Input
                id="webhook-name"
                value={webhookForm.name}
                onChange={e => setWebhookForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Security Team Slack"
              />
            </div>

            <div>
              <Label htmlFor="webhook-url">Webhook URL</Label>
              <Input
                id="webhook-url"
                value={webhookForm.url}
                onChange={e => setWebhookForm(f => ({ ...f, url: e.target.value }))}
                placeholder="https://hooks.example.com/webhook/..."
                type="url"
              />
            </div>

            <div>
              <Label htmlFor="webhook-secret">HMAC Secret (Optional)</Label>
              <Input
                id="webhook-secret"
                value={webhookForm.secret}
                onChange={e => setWebhookForm(f => ({ ...f, secret: e.target.value }))}
                placeholder="Optional secret for payload signing"
                type="password"
              />
              <p className="text-xs text-muted-foreground mt-1">
                If set, payloads are signed with HMAC-SHA256. Signature is sent in the X-Webhook-Signature header.
              </p>
            </div>

            <div>
              <Label htmlFor="webhook-headers">Custom Headers (Optional, JSON)</Label>
              <Textarea
                id="webhook-headers"
                value={webhookForm.headers}
                onChange={e => setWebhookForm(f => ({ ...f, headers: e.target.value }))}
                placeholder={'{\n  "Authorization": "Bearer token"\n}'}
                rows={3}
                className="font-mono text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWebhookDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveWebhook}>
              {editingWebhook ? "Update" : "Create"} Webhook
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============ VIEW PAYLOAD DIALOG ============ */}
      <Dialog open={viewPayload !== null} onOpenChange={() => setViewPayload(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Webhook Payload</DialogTitle>
            <DialogDescription>The JSON payload that was sent to the webhook.</DialogDescription>
          </DialogHeader>
          <div className="overflow-auto max-h-[60vh]">
            <pre className="bg-muted p-4 rounded-lg text-xs font-mono whitespace-pre-wrap break-all">
              {viewPayload ? JSON.stringify(JSON.parse(viewPayload), null, 2) : ""}
            </pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewPayload(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
