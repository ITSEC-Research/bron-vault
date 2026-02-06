"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  FileUp, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  Globe,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Ban,
  AlertCircle,
  ShieldAlert,
  HardDrive,
  FileText,
  Database
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { useAuth, isAdmin as checkIsAdmin } from "@/hooks/useAuth"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip"

interface ImportLog {
  id: number
  job_id: string
  user_id: number | null
  user_email: string | null
  api_key_id: number | null
  api_key_name?: string | null
  source: 'web' | 'api'
  filename: string | null
  file_size: number | null
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  total_devices: number
  processed_devices: number
  total_credentials: number
  total_files: number
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

interface ImportStats {
  total_imports: number
  completed_imports: number
  failed_imports: number
  web_imports: number
  api_imports: number
  total_devices: number
  total_credentials: number
  total_files: number
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface FilterState {
  source: string
  status: string
  user_id: string
  start_date: string
  end_date: string
  search: string
}

// Status icon and color mapping
const statusConfig: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  'pending': { icon: Clock, color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30', label: 'Pending' },
  'processing': { icon: Loader2, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'Processing' },
  'completed': { icon: CheckCircle2, color: 'bg-green-500/20 text-green-400 border-green-500/30', label: 'Completed' },
  'failed': { icon: XCircle, color: 'bg-red-500/20 text-red-400 border-red-500/30', label: 'Failed' },
  'cancelled': { icon: Ban, color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', label: 'Cancelled' }
}

// Source icon mapping
const sourceConfig: Record<string, { icon: typeof Globe; color: string; label: string }> = {
  'web': { icon: Globe, color: 'bg-purple-500/20 text-purple-400 border-purple-500/30', label: 'Web Upload' },
  'api': { icon: Key, color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', label: 'API Upload' }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || bytes === 0) return '-'
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`
}

function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return '-'
  const start = new Date(startedAt)
  const end = completedAt ? new Date(completedAt) : new Date()
  const diffMs = end.getTime() - start.getTime()
  
  if (diffMs < 1000) return '<1s'
  if (diffMs < 60000) return `${Math.round(diffMs / 1000)}s`
  if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}m ${Math.round((diffMs % 60000) / 1000)}s`
  return `${Math.round(diffMs / 3600000)}h ${Math.round((diffMs % 3600000) / 60000)}m`
}

export default function ImportLogsPage() {
  const { user: currentUser, loading: authLoading } = useAuth(true)
  const userIsAdmin = checkIsAdmin(currentUser)
  const { toast } = useToast()
  
  const [logs, setLogs] = useState<ImportLog[]>([])
  const [stats, setStats] = useState<ImportStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })
  
  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    source: '',
    status: '',
    user_id: '',
    start_date: '',
    end_date: '',
    search: ''
  })
  const [showFilters, setShowFilters] = useState(false)

  // Load logs when filters change
  useEffect(() => {
    if (userIsAdmin) {
      loadLogs()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsAdmin, pagination.page, filters])

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit)
      })
      
      if (filters.source) params.set('source', filters.source)
      if (filters.status) params.set('status', filters.status)
      if (filters.user_id) params.set('user_id', filters.user_id)
      if (filters.start_date) params.set('start_date', filters.start_date)
      if (filters.end_date) params.set('end_date', filters.end_date)
      if (filters.search) params.set('search', filters.search)
      
      const response = await fetch(`/api/import-logs?${params}`, {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setLogs(data.logs)
        setStats(data.stats)
        setPagination((prev: Pagination) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }))
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to load import logs"
        })
      }
    } catch (error) {
      console.error('Load logs error:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load import logs"
      })
    } finally {
      setLoading(false)
    }
  }, [pagination.page, pagination.limit, filters, toast])

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev: FilterState) => ({ ...prev, [key]: value }))
    setPagination((prev: Pagination) => ({ ...prev, page: 1 }))
  }

  const clearFilters = () => {
    setFilters({
      source: '',
      status: '',
      user_id: '',
      start_date: '',
      end_date: '',
      search: ''
    })
    setPagination((prev: Pagination) => ({ ...prev, page: 1 }))
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-'
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
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

  // Access denied for non-admin users
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
                    You don&apos;t have permission to view import logs
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-destructive/30 bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-foreground">
                  <strong>Admin Role Required:</strong> Only administrators can view import logs.
                </AlertDescription>
              </Alert>
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
    <TooltipProvider>
      <main className="flex-1 p-6 bg-background">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
                <FileUp className="h-8 w-8" />
                Import Logs
              </h1>
              <p className="text-muted-foreground mt-2">Track all data import operations via web or API</p>
            </div>
            <div className="flex items-center gap-2">
              <Popover open={showFilters} onOpenChange={setShowFilters}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="glass-card border-border/50">
                    <Filter className="mr-2 h-4 w-4" />
                    Filters
                    {Object.values(filters).some(Boolean) && (
                      <Badge variant="secondary" className="ml-2">Active</Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 glass-modal" align="end">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Source</Label>
                      <Select value={filters.source} onValueChange={(v: string) => handleFilterChange('source', v)}>
                        <SelectTrigger className="glass-card border-border/50">
                          <SelectValue placeholder="All sources" />
                        </SelectTrigger>
                        <SelectContent className="glass-modal">
                          <SelectItem value="">All sources</SelectItem>
                          <SelectItem value="web">Web Upload</SelectItem>
                          <SelectItem value="api">API Upload</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={filters.status} onValueChange={(v: string) => handleFilterChange('status', v)}>
                        <SelectTrigger className="glass-card border-border/50">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent className="glass-modal">
                          <SelectItem value="">All statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="failed">Failed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input
                        type="date"
                        value={filters.start_date}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange('start_date', e.target.value)}
                        className="glass-card border-border/50"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>End Date</Label>
                      <Input
                        type="date"
                        value={filters.end_date}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange('end_date', e.target.value)}
                        className="glass-card border-border/50"
                      />
                    </div>
                    
                    <Button variant="outline" onClick={clearFilters} className="w-full">
                      Clear Filters
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button
                variant="outline"
                onClick={() => loadLogs()}
                disabled={loading}
                className="glass-card border-border/50"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card className="glass-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/20">
                      <FileUp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.total_imports}</p>
                      <p className="text-xs text-muted-foreground">Total Imports</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-500/20">
                      <CheckCircle2 className="h-5 w-5 text-green-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.completed_imports}</p>
                      <p className="text-xs text-muted-foreground">Completed</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <HardDrive className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.total_devices?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Devices</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="glass-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-500/20">
                      <Database className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">{stats.total_credentials?.toLocaleString() || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Credentials</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by email, filename, or job ID..."
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              className="pl-10 glass-card border-border/50"
            />
          </div>

          {/* Logs Table */}
          <Card className="glass-card border-border/50">
            <CardContent className="p-0">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : logs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                  <FileUp className="h-12 w-12 mb-4 opacity-50" />
                  <p>No import logs found</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border/50 hover:bg-transparent">
                      <TableHead className="text-muted-foreground w-[160px]">Timestamp</TableHead>
                      <TableHead className="text-muted-foreground">User</TableHead>
                      <TableHead className="text-muted-foreground">Source</TableHead>
                      <TableHead className="text-muted-foreground">File</TableHead>
                      <TableHead className="text-muted-foreground">Status</TableHead>
                      <TableHead className="text-muted-foreground text-right">Results</TableHead>
                      <TableHead className="text-muted-foreground text-right">Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => {
                      const statusCfg = statusConfig[log.status]
                      const sourceCfg = sourceConfig[log.source]
                      const StatusIcon = statusCfg.icon
                      const SourceIcon = sourceCfg.icon
                      
                      return (
                        <TableRow key={log.id} className="border-border/50">
                          <TableCell className="text-muted-foreground text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3 w-3" />
                              {formatDate(log.created_at)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-foreground text-sm">
                                {log.user_email || <span className="text-muted-foreground italic">Unknown</span>}
                              </p>
                              {log.api_key_name && (
                                <p className="text-xs text-muted-foreground flex items-center gap-1">
                                  <Key className="h-3 w-3" />
                                  {log.api_key_name}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={sourceCfg.color}>
                              <SourceIcon className="h-3 w-3 mr-1" />
                              {sourceCfg.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="text-foreground text-sm truncate max-w-[200px]" title={log.filename || undefined}>
                                {log.filename || '-'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {formatBytes(log.file_size)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Badge variant="outline" className={statusCfg.color}>
                                  <StatusIcon className={`h-3 w-3 mr-1 ${log.status === 'processing' ? 'animate-spin' : ''}`} />
                                  {statusCfg.label}
                                </Badge>
                              </TooltipTrigger>
                              {log.error_message && (
                                <TooltipContent className="max-w-sm">
                                  <p className="text-sm">{log.error_message}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="space-y-1 text-sm">
                              <p className="text-foreground flex items-center justify-end gap-1">
                                <HardDrive className="h-3 w-3 text-muted-foreground" />
                                {log.processed_devices}/{log.total_devices}
                              </p>
                              <p className="text-muted-foreground flex items-center justify-end gap-1">
                                <FileText className="h-3 w-3" />
                                {log.total_credentials.toLocaleString()} creds
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground text-sm">
                            {formatDuration(log.started_at, log.completed_at)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
            
            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-border/50">
                <div className="text-sm text-muted-foreground">
                  Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} entries
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((prev: Pagination) => ({ ...prev, page: prev.page - 1 }))}
                    disabled={pagination.page === 1}
                    className="glass-card border-border/50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination((prev: Pagination) => ({ ...prev, page: prev.page + 1 }))}
                    disabled={pagination.page >= pagination.totalPages}
                    className="glass-card border-border/50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </div>
      </main>
    </TooltipProvider>
  )
}
