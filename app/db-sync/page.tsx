"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Database, CheckCircle2, XCircle, AlertTriangle, ArrowRight, RefreshCw, Info } from "lucide-react"
import { useRouter } from "next/navigation"

interface SchemaDifference {
  type: string
  table: string
  detail: string
  expected?: string
  actual?: string
  severity: 'critical' | 'warning' | 'info'
  fixQuery?: string
}

interface SchemaCheckResult {
  success: boolean
  isValid: boolean
  schemaVersion: string
  differences: SchemaDifference[]
  missingTables: string[]
  extraTables: string[]
  summary: {
    totalTables: number
    validTables: number
    totalColumns: number
    validColumns: number
    totalIndexes: number
    validIndexes: number
    criticalIssues: number
    warnings: number
  }
  error?: string
}

interface SyncResult {
  success: boolean
  message: string
  executed: number
  failed: number
  executedQueries?: string[]
  failedQueries?: { query: string; error: string }[]
  currentStatus?: SchemaCheckResult
}

export default function DbSyncPage() {
  const router = useRouter()
  const [isChecking, setIsChecking] = useState(true)
  const [isSyncing, setIsSyncing] = useState(false)
  const [schemaResult, setSchemaResult] = useState<SchemaCheckResult | null>(null)
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const checkSchema = async () => {
    setIsChecking(true)
    setError(null)
    setSyncResult(null)
    
    try {
      const response = await fetch("/api/db-sync")
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || "Failed to check schema")
        return
      }
      
      setSchemaResult(data)
    } catch (_err) {
      setError("Failed to connect to database sync API")
    } finally {
      setIsChecking(false)
    }
  }

  const syncSchema = async () => {
    setIsSyncing(true)
    setError(null)
    
    try {
      const response = await fetch("/api/db-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync" })
      })
      
      const data = await response.json()
      setSyncResult(data)
      
      if (data.currentStatus) {
        setSchemaResult(data.currentStatus)
      }
    } catch (_err) {
      setError("Failed to sync database schema")
    } finally {
      setIsSyncing(false)
    }
  }

  useEffect(() => {
    checkSchema()
  }, [])

  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <Badge variant="destructive" className="text-xs">Critical</Badge>
      case 'warning':
        return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-500 text-xs">Warning</Badge>
      default:
        return <Badge variant="outline" className="text-xs">Info</Badge>
    }
  }

  const getTypeIcon = (type: string) => {
    if (type.includes('missing')) {
      return <XCircle className="h-4 w-4 text-destructive" />
    } else if (type.includes('mismatch')) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />
    } else {
      return <Info className="h-4 w-4 text-muted-foreground" />
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header Card */}
        <Card className="glass-card border-border/50">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Database className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">Database Schema Sync</CardTitle>
            <CardDescription>
              Synchronize your database schema with the application requirements
            </CardDescription>
          </CardHeader>
        </Card>

        {/* Loading State */}
        {isChecking && (
          <Card className="glass-card border-border/50">
            <CardContent className="py-12">
              <div className="flex flex-col items-center justify-center space-y-4">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-muted-foreground">Checking database schema...</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Error State */}
        {error && (
          <Card className="glass-card border-destructive/50">
            <CardContent className="py-6">
              <div className="flex items-center space-x-4">
                <XCircle className="h-8 w-8 text-destructive shrink-0" />
                <div>
                  <p className="font-medium text-destructive">Error</p>
                  <p className="text-sm text-muted-foreground">{error}</p>
                </div>
              </div>
              <Button variant="outline" onClick={checkSchema} className="mt-4">
                <RefreshCw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Schema Status */}
        {!isChecking && schemaResult && (
          <>
            {/* Summary Card */}
            <Card className={`glass-card ${schemaResult.isValid ? 'border-green-500/50' : 'border-yellow-500/50'}`}>
              <CardContent className="py-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    {schemaResult.isValid ? (
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-10 w-10 text-yellow-500" />
                    )}
                    <div>
                      <p className="font-medium text-lg">
                        {schemaResult.isValid ? "Schema is up to date" : "Schema synchronization required"}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Schema Version: {schemaResult.schemaVersion}
                      </p>
                    </div>
                  </div>
                  
                  {schemaResult.isValid ? (
                    <Button onClick={() => router.push("/login")} className="bg-green-500 hover:bg-green-600">
                      Continue to Login
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  ) : (
                    <Button 
                      onClick={syncSchema} 
                      disabled={isSyncing}
                      className="bg-primary"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Syncing...
                        </>
                      ) : (
                        <>
                          <Database className="h-4 w-4 mr-2" />
                          Sync Database
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                  <div className="text-center p-3 rounded-lg bg-card/50">
                    <p className="text-2xl font-bold">{schemaResult.summary.validTables}/{schemaResult.summary.totalTables}</p>
                    <p className="text-xs text-muted-foreground">Tables</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-card/50">
                    <p className="text-2xl font-bold">{schemaResult.summary.validColumns}/{schemaResult.summary.totalColumns}</p>
                    <p className="text-xs text-muted-foreground">Columns</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-card/50">
                    <p className={`text-2xl font-bold ${schemaResult.summary.criticalIssues > 0 ? 'text-destructive' : 'text-green-500'}`}>
                      {schemaResult.summary.criticalIssues}
                    </p>
                    <p className="text-xs text-muted-foreground">Critical Issues</p>
                  </div>
                  <div className="text-center p-3 rounded-lg bg-card/50">
                    <p className={`text-2xl font-bold ${schemaResult.summary.warnings > 0 ? 'text-yellow-500' : 'text-green-500'}`}>
                      {schemaResult.summary.warnings}
                    </p>
                    <p className="text-xs text-muted-foreground">Warnings</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Sync Result */}
            {syncResult && (
              <Card className={`glass-card ${syncResult.success ? 'border-green-500/50' : 'border-yellow-500/50'}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center">
                    {syncResult.success ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500 mr-2" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-yellow-500 mr-2" />
                    )}
                    Sync Result
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{syncResult.message}</p>
                  <div className="flex items-center space-x-4 mt-3">
                    <Badge variant="secondary" className="bg-green-500/20 text-green-500">
                      {syncResult.executed} executed
                    </Badge>
                    {syncResult.failed > 0 && (
                      <Badge variant="destructive">
                        {syncResult.failed} failed
                      </Badge>
                    )}
                  </div>
                  
                  {syncResult.success && schemaResult.isValid && (
                    <Button onClick={() => router.push("/login")} className="mt-4 bg-green-500 hover:bg-green-600">
                      Continue to Login
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Differences List */}
            {!schemaResult.isValid && schemaResult.differences.length > 0 && (
              <Card className="glass-card border-border/50">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Schema Differences</CardTitle>
                  <CardDescription>
                    {schemaResult.differences.length} differences found
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {schemaResult.differences
                      .filter(d => d.severity !== 'info')
                      .map((diff, index) => (
                      <div 
                        key={index} 
                        className="flex items-start space-x-3 p-3 rounded-lg bg-card/50 hover:bg-card/70 transition-colors"
                      >
                        {getTypeIcon(diff.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-sm text-primary">{diff.table}</span>
                            {getSeverityBadge(diff.severity)}
                          </div>
                          <p className="text-sm text-foreground mt-1">{diff.detail}</p>
                          {diff.expected && (
                            <p className="text-xs text-muted-foreground mt-1">
                              Expected: <span className="text-green-500">{diff.expected}</span>
                              {diff.actual && <> | Actual: <span className="text-destructive">{diff.actual}</span></>}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Info differences (collapsible) */}
                  {schemaResult.differences.filter(d => d.severity === 'info').length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                        {schemaResult.differences.filter(d => d.severity === 'info').length} informational items
                      </summary>
                      <div className="space-y-2 mt-2">
                        {schemaResult.differences
                          .filter(d => d.severity === 'info')
                          .map((diff, index) => (
                          <div 
                            key={index} 
                            className="flex items-start space-x-3 p-2 rounded-lg bg-muted/30"
                          >
                            <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                            <div>
                              <span className="font-mono text-xs text-muted-foreground">{diff.table}</span>
                              <p className="text-xs text-muted-foreground">{diff.detail}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Refresh Button */}
            <div className="flex justify-center">
              <Button variant="outline" onClick={checkSchema} disabled={isChecking}>
                <RefreshCw className={`h-4 w-4 mr-2 ${isChecking ? 'animate-spin' : ''}`} />
                Recheck Schema
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
