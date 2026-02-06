"use client"

import { useState, useEffect, useCallback } from "react"
import { 
  ClipboardList, 
  Search, 
  Filter, 
  ChevronLeft, 
  ChevronRight, 
  RefreshCw,
  User,
  Key,
  Settings,
  Upload,
  HardDrive,
  Download,
  AlertCircle,
  ShieldAlert,
  Clock
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface AuditLog {
  id: number
  user_id: number | null
  user_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  details: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

interface FilterOptions {
  actions: string[]
  resourceTypes: string[]
  users: { id: number; email: string }[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface FilterState {
  action: string
  resource_type: string
  user_id: string
  start_date: string
  end_date: string
  search: string
}

// Action icon mapping
const actionIcons: Record<string, typeof User> = {
  'user': User,
  'api_key': Key,
  'settings': Settings,
  'upload': Upload,
  'device': HardDrive,
  'export': Download
}

// Action color mapping
const actionColors: Record<string, string> = {
  'create': 'bg-green-500/20 text-green-400 border-green-500/30',
  'update': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'delete': 'bg-red-500/20 text-red-400 border-red-500/30',
  'login': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'logout': 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  'fail': 'bg-red-500/20 text-red-400 border-red-500/30',
  'start': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'complete': 'bg-green-500/20 text-green-400 border-green-500/30',
  'revoke': 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  'enable': 'bg-green-500/20 text-green-400 border-green-500/30',
  'disable': 'bg-red-500/20 text-red-400 border-red-500/30',
  'change': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
}

function getActionColor(action: string): string {
  const parts = action.split('.')
  for (let i = parts.length - 1; i >= 0; i--) {
    if (actionColors[parts[i]]) {
      return actionColors[parts[i]]
    }
  }
  return 'bg-gray-500/20 text-gray-400 border-gray-500/30'
}

function getResourceIcon(resourceType: string) {
  const Icon = actionIcons[resourceType] || ClipboardList
  return Icon
}

function formatAction(action: string): string {
  return action.split('.').map(part => 
    part.charAt(0).toUpperCase() + part.slice(1)
  ).join(' → ')
}

export default function AuditLogsPage() {
  const { user: currentUser, loading: authLoading } = useAuth(true)
  const userIsAdmin = checkIsAdmin(currentUser)
  const { toast } = useToast()
  
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0
  })
  
  // Filter states
  const [filters, setFilters] = useState<FilterState>({
    action: '',
    resource_type: '',
    user_id: '',
    start_date: '',
    end_date: '',
    search: ''
  })
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    actions: [],
    resourceTypes: [],
    users: []
  })
  const [showFilters, setShowFilters] = useState(false)
  
  // Detail dialog
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)

  // Load filter options
  useEffect(() => {
    if (userIsAdmin) {
      loadFilterOptions()
    }
  }, [userIsAdmin])
  
  // Load logs when filters change
  useEffect(() => {
    if (userIsAdmin) {
      loadLogs()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userIsAdmin, pagination.page, filters])
  
  const loadFilterOptions = async () => {
    try {
      const response = await fetch('/api/audit-logs/filters', {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setFilterOptions(data)
      }
    } catch (error) {
      console.error('Failed to load filter options:', error)
    }
  }

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true)
      
      const params = new URLSearchParams({
        page: String(pagination.page),
        limit: String(pagination.limit)
      })
      
      if (filters.action) params.set('action', filters.action)
      if (filters.resource_type) params.set('resource_type', filters.resource_type)
      if (filters.user_id) params.set('user_id', filters.user_id)
      if (filters.start_date) params.set('start_date', filters.start_date)
      if (filters.end_date) params.set('end_date', filters.end_date)
      if (filters.search) params.set('search', filters.search)
      
      const response = await fetch(`/api/audit-logs?${params}`, {
        credentials: 'include'
      })
      const data = await response.json()
      
      if (data.success) {
        setLogs(data.logs)
        setPagination((prev: Pagination) => ({
          ...prev,
          total: data.pagination.total,
          totalPages: data.pagination.totalPages
        }))
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: data.error || "Failed to load audit logs"
        })
      }
    } catch (error) {
      console.error('Load logs error:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to load audit logs"
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
      action: '',
      resource_type: '',
      user_id: '',
      start_date: '',
      end_date: '',
      search: ''
    })
    setPagination((prev: Pagination) => ({ ...prev, page: 1 }))
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })
  }

  const openDetailDialog = (log: AuditLog) => {
    setSelectedLog(log)
    setDetailDialogOpen(true)
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
                    You don&apos;t have permission to view audit logs
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert className="border-destructive/30 bg-destructive/10">
                <AlertCircle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-foreground">
                  <strong>Admin Role Required:</strong> Only administrators can view audit logs.
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
    <main className="flex-1 p-6 bg-background">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <ClipboardList className="h-8 w-8" />
              Audit Logs
            </h1>
            <p className="text-muted-foreground mt-2">Track all user activities and system changes</p>
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
                    <Label>Action</Label>
                    <Select value={filters.action} onValueChange={(v: string) => handleFilterChange('action', v)}>
                      <SelectTrigger className="glass-card border-border/50">
                        <SelectValue placeholder="All actions" />
                      </SelectTrigger>
                      <SelectContent className="glass-modal">
                        <SelectItem value="">All actions</SelectItem>
                        {filterOptions.actions.map((action: string) => (
                          <SelectItem key={action} value={action}>{formatAction(action)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Resource Type</Label>
                    <Select value={filters.resource_type} onValueChange={(v: string) => handleFilterChange('resource_type', v)}>
                      <SelectTrigger className="glass-card border-border/50">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent className="glass-modal">
                        <SelectItem value="">All types</SelectItem>
                        {filterOptions.resourceTypes.map((type: string) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>User</Label>
                    <Select value={filters.user_id} onValueChange={(v: string) => handleFilterChange('user_id', v)}>
                      <SelectTrigger className="glass-card border-border/50">
                        <SelectValue placeholder="All users" />
                      </SelectTrigger>
                      <SelectContent className="glass-modal">
                        <SelectItem value="">All users</SelectItem>
                        {filterOptions.users.map((user: { id: number; email: string }) => (
                          <SelectItem key={user.id} value={String(user.id)}>{user.email}</SelectItem>
                        ))}
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

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by email, resource ID, or details..."
            value={filters.search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFilterChange('search', e.target.value)}
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
                <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
                <p>No audit logs found</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-border/50 hover:bg-transparent">
                    <TableHead className="text-muted-foreground w-[180px]">Timestamp</TableHead>
                    <TableHead className="text-muted-foreground">User</TableHead>
                    <TableHead className="text-muted-foreground">Action</TableHead>
                    <TableHead className="text-muted-foreground">Resource</TableHead>
                    <TableHead className="text-muted-foreground">IP Address</TableHead>
                    <TableHead className="text-muted-foreground text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => {
                    const ResourceIcon = getResourceIcon(log.resource_type)
                    return (
                      <TableRow key={log.id} className="border-border/50">
                        <TableCell className="text-muted-foreground text-sm">
                          <div className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {formatDate(log.created_at)}
                          </div>
                        </TableCell>
                        <TableCell className="text-foreground">
                          {log.user_email || (
                            <span className="text-muted-foreground italic">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant="outline"
                            className={`transition-colors ${getActionColor(log.action)}`}
                          >
                            {formatAction(log.action)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <ResourceIcon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{log.resource_type}</span>
                            {log.resource_id && (
                              <span className="text-muted-foreground text-xs">
                                #{log.resource_id.length > 20 ? `${log.resource_id.substring(0, 20)}...` : log.resource_id}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {log.ip_address || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDetailDialog(log)}
                            className="h-8 hover:bg-secondary"
                          >
                            View
                          </Button>
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

        {/* Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="glass-modal sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle className="text-foreground">Audit Log Details</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                Complete information about this audit log entry
              </DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground text-xs">Timestamp</Label>
                    <p className="text-foreground">{formatDate(selectedLog.created_at)}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">User</Label>
                    <p className="text-foreground">{selectedLog.user_email || 'System'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Action</Label>
                    <Badge variant="outline" className={getActionColor(selectedLog.action)}>
                      {formatAction(selectedLog.action)}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Resource Type</Label>
                    <p className="text-foreground">{selectedLog.resource_type}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">Resource ID</Label>
                    <p className="text-foreground break-all">{selectedLog.resource_id || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-muted-foreground text-xs">IP Address</Label>
                    <p className="text-foreground">{selectedLog.ip_address || '-'}</p>
                  </div>
                </div>
                
                {selectedLog.user_agent && (
                  <div>
                    <Label className="text-muted-foreground text-xs">User Agent</Label>
                    <p className="text-foreground text-sm break-all">{selectedLog.user_agent}</p>
                  </div>
                )}
                
                <div>
                  <Label className="text-muted-foreground text-xs">Details</Label>
                  <pre className="text-foreground text-sm bg-secondary/50 p-3 rounded-lg overflow-auto max-h-[200px]">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </main>
  )
}
