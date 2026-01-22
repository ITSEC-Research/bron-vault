"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Copy, BookOpen, Key, Search, Upload, Database, Shield, Clock, Zap, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function DocsPage() {
  const { toast } = useToast()
  const [activeSection, setActiveSection] = useState("search-credentials")
  const [baseUrl, setBaseUrl] = useState("")

  useEffect(() => {
    // Auto-detect domain from current URL
    if (typeof window !== 'undefined') {
      setBaseUrl(window.location.origin)
    }
  }, [])

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Code copied to clipboard"
    })
  }

  // Syntax highlighted code block component
  const CodeBlock = ({ code, language = "bash" }: { code: string; language?: string }) => {
    const highlightCode = (code: string, lang: string) => {
      if (lang === "json") {
        return code
          .replace(/"([^"]+)":/g, '<span class="text-purple-400">"$1"</span>:')
          .replace(/: "([^"]*)"/g, ': <span class="text-emerald-400">"$1"</span>')
          .replace(/: (\d+)/g, ': <span class="text-amber-400">$1</span>')
          .replace(/: (true|false|null)/g, ': <span class="text-blue-400">$1</span>')
          .replace(/\/\/.*$/gm, '<span class="text-muted-foreground">$&</span>')
      }
      if (lang === "bash") {
        return code
          .replace(/^(curl)/gm, '<span class="text-emerald-400">$1</span>')
          .replace(/(-X\s+)(GET|POST|PUT|DELETE|PATCH)/g, '$1<span class="text-amber-400">$2</span>')
          .replace(/(-H\s+)("[^"]*")/g, '$1<span class="text-blue-400">$2</span>')
          .replace(/(-d\s+)('[^']*')/g, '$1<span class="text-purple-400">$2</span>')
          .replace(/(-F\s+)("[^"]*")/g, '$1<span class="text-purple-400">$2</span>')
          .replace(/(https?:\/\/[^\s"'\\]+)/g, '<span class="text-cyan-400">$1</span>')
      }
      return code
    }

    return (
      <div className="relative group">
        <pre className="bg-zinc-950 border border-border/50 p-4 rounded-lg text-sm overflow-x-auto font-mono">
          <code 
            className={`language-${language}`}
            dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }}
          />
        </pre>
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 right-2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-muted"
          onClick={() => copyToClipboard(code)}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    )
  }

  // Parameter table component
  const ParameterTable = ({ params }: { params: Array<{ name: string; type: string; required: boolean; description: string; default?: string }> }) => (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-border/50 bg-muted/20 hover:bg-muted/20">
            <TableHead className="text-muted-foreground font-semibold">Parameter</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Type</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Required</TableHead>
            <TableHead className="text-muted-foreground font-semibold">Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {params.map((param) => (
            <TableRow key={param.name} className="border-border/50">
              <TableCell>
                <code className="text-sm font-mono text-foreground bg-muted/30 px-1.5 py-0.5 rounded">{param.name}</code>
              </TableCell>
              <TableCell>
                <span className="text-sm text-blue-400">{param.type}</span>
              </TableCell>
              <TableCell>
                {param.required ? (
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/30 text-xs">Required</Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground text-xs">Optional</Badge>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {param.description}
                {param.default && (
                  <span className="block text-xs mt-1">Default: <code className="bg-muted/30 px-1 rounded">{param.default}</code></span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )

  const sections = [
    { id: "search-credentials", label: "Search Credentials", icon: Search, method: "POST" },
    { id: "search-domain", label: "Search Domain", icon: Search, method: "POST" },
    { id: "search-bulk", label: "Bulk Search", icon: Search, method: "POST" },
    { id: "lookup", label: "Lookup", icon: Database, method: "GET" },
    { id: "upload", label: "Upload", icon: Upload, method: "POST" },
    { id: "api-keys", label: "API Keys", icon: Key, method: "CRUD" },
  ]

  return (
    <main className="flex-1 p-6 bg-background">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <BookOpen className="h-7 w-7 text-primary" />
              </div>
              API Documentation
            </h1>
            <p className="text-muted-foreground mt-2">
              Complete reference for the BronVault REST API v1
            </p>
          </div>
          <Link href="/api-keys">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <Key className="mr-2 h-4 w-4" />
              Manage API Keys
            </Button>
          </Link>
        </div>

        {/* Base Info Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="glass-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <Shield className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Authentication</p>
                  <code className="text-sm font-mono text-foreground">X-API-Key</code>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Database className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Format</p>
                  <p className="text-sm font-medium text-foreground">JSON</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Zap className="h-5 w-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Base URL</p>
                  <code className="text-sm font-mono text-foreground">/api/v1</code>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="glass-card border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Clock className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Rate Limit</p>
                  <p className="text-sm font-medium text-foreground">Per API Key</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Navigation */}
        <Card className="glass-card border-border/50">
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-2">
              {sections.map((section) => (
                <Button 
                  key={section.id}
                  variant={activeSection === section.id ? "default" : "outline"} 
                  size="sm"
                  onClick={() => setActiveSection(section.id)}
                  className={activeSection === section.id ? "bg-primary text-primary-foreground" : "glass-card border-border/50"}
                >
                  <section.icon className="h-4 w-4 mr-2" />
                  {section.label}
                  <Badge 
                    variant="outline" 
                    className={`ml-2 text-xs ${
                      section.method === "GET" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
                      section.method === "POST" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
                      "bg-purple-500/10 text-purple-400 border-purple-500/30"
                    }`}
                  >
                    {section.method}
                  </Badge>
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search Credentials Section */}
        {activeSection === "search-credentials" && (
          <div className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-mono">POST</Badge>
                  <code className="text-lg font-mono text-foreground">/api/v1/search/credentials</code>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  Search credentials by email, username, or password. Returns paginated results with device information.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parameters */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    Request Body Parameters
                  </h4>
                  <ParameterTable params={[
                    { name: "query", type: "string", required: true, description: "The search query (email, username, or password)" },
                    { name: "type", type: "string", required: false, description: "Search type: email, username, password, or any", default: "any" },
                    { name: "page", type: "number", required: false, description: "Page number for pagination", default: "1" },
                    { name: "limit", type: "number", required: false, description: "Number of results per page (max 100)", default: "50" },
                    { name: "includePasswords", type: "boolean", required: false, description: "Include full passwords in response (admin only)", default: "false" },
                  ]} />
                </div>

                {/* Example Request */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl -X POST "${baseUrl}/api/v1/search/credentials" \\
  -H "X-API-Key: bv_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "john@example.com", "type": "email", "page": 1, "limit": 50}'`} />
                </div>

                {/* Response */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Success Response
                    <Badge variant="outline" className="text-xs">200 OK</Badge>
                  </h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "success": true,
  "data": {
    "credentials": [
      {
        "deviceId": "device_123",
        "deviceName": "WIN-ABC123",
        "url": "https://example.com/login",
        "domain": "example.com",
        "username": "john@example.com",
        "passwordMasked": "p********d",
        "browser": "Chrome",
        "country": "US",
        "uploadDate": "2024-01-15T10:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 150,
      "totalPages": 3,
      "hasMore": true
    }
  }
}`}
                  />
                </div>

                {/* Error Response */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-400" />
                    Error Response
                    <Badge variant="outline" className="text-xs">4xx/5xx</Badge>
                  </h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "success": false,
  "error": "Invalid or missing API key",
  "code": "INVALID_API_KEY"
}`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search Domain Section */}
        {activeSection === "search-domain" && (
          <div className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-mono">POST</Badge>
                  <code className="text-lg font-mono text-foreground">/api/v1/search/domain</code>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  Search all credentials for a specific domain. Optionally includes subdomains.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parameters */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Request Body Parameters</h4>
                  <ParameterTable params={[
                    { name: "domain", type: "string", required: true, description: "The domain to search for (e.g., example.com)" },
                    { name: "includeSubdomains", type: "boolean", required: false, description: "Include subdomains in search results", default: "false" },
                    { name: "page", type: "number", required: false, description: "Page number for pagination", default: "1" },
                    { name: "limit", type: "number", required: false, description: "Number of results per page (max 100)", default: "50" },
                  ]} />
                </div>

                {/* Example Request */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl -X POST "${baseUrl}/api/v1/search/domain" \\
  -H "X-API-Key: bv_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"domain": "example.com", "includeSubdomains": true, "page": 1, "limit": 50}'`} />
                </div>

                {/* Response */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Success Response
                    <Badge variant="outline" className="text-xs">200 OK</Badge>
                  </h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "success": true,
  "data": {
    "domain": "example.com",
    "credentials": [
      {
        "deviceId": "device_456",
        "deviceName": "DESKTOP-XYZ",
        "url": "https://login.example.com",
        "subdomain": "login.example.com",
        "username": "admin@example.com",
        "passwordMasked": "a********n",
        "browser": "Firefox",
        "country": "DE"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 75,
      "totalPages": 2,
      "hasMore": true
    }
  }
}`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Bulk Search Section */}
        {activeSection === "search-bulk" && (
          <div className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-mono">POST</Badge>
                  <code className="text-lg font-mono text-foreground">/api/v1/search/bulk</code>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  Search for multiple queries in a single request. Useful for batch processing.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parameters */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Request Body Parameters</h4>
                  <ParameterTable params={[
                    { name: "queries", type: "array", required: true, description: "Array of search objects with query and type" },
                    { name: "queries[].query", type: "string", required: true, description: "The search query" },
                    { name: "queries[].type", type: "string", required: false, description: "Search type: email, username, password, or any", default: "any" },
                    { name: "limit", type: "number", required: false, description: "Max results per query (max 50)", default: "10" },
                  ]} />
                </div>

                {/* Example Request */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl -X POST "${baseUrl}/api/v1/search/bulk" \\
  -H "X-API-Key: bv_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "queries": [
      {"query": "john@example.com", "type": "email"},
      {"query": "jane@example.com", "type": "email"},
      {"query": "admin", "type": "username"}
    ],
    "limit": 10
  }'`} />
                </div>

                {/* Response */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Success Response
                    <Badge variant="outline" className="text-xs">200 OK</Badge>
                  </h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "success": true,
  "data": {
    "results": [
      {
        "query": "john@example.com",
        "type": "email",
        "found": true,
        "count": 5,
        "credentials": [...]
      },
      {
        "query": "jane@example.com",
        "type": "email",
        "found": false,
        "count": 0,
        "credentials": []
      }
    ],
    "summary": {
      "totalQueries": 3,
      "queriesWithResults": 2,
      "totalCredentials": 12
    }
  }
}`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lookup Section */}
        {activeSection === "lookup" && (
          <div className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-mono">GET</Badge>
                  <code className="text-lg font-mono text-foreground">/api/v1/lookup</code>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  Quick lookup to check if an email or domain exists. Returns summary statistics without full credential data.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parameters */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Query Parameters</h4>
                  <ParameterTable params={[
                    { name: "email", type: "string", required: false, description: "Email address to lookup (use this OR domain)" },
                    { name: "domain", type: "string", required: false, description: "Domain to lookup (use this OR email)" },
                  ]} />
                  <p className="text-sm text-amber-500 mt-3 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4" />
                    Either <code className="bg-muted/50 px-1 rounded">email</code> or <code className="bg-muted/50 px-1 rounded">domain</code> must be provided, but not both.
                  </p>
                </div>

                {/* Example Request - Email */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request (Email Lookup)</h4>
                  <CodeBlock code={`curl "${baseUrl}/api/v1/lookup?email=john@example.com" \\
  -H "X-API-Key: bv_your_api_key"`} />
                </div>

                {/* Example Request - Domain */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request (Domain Lookup)</h4>
                  <CodeBlock code={`curl "${baseUrl}/api/v1/lookup?domain=example.com" \\
  -H "X-API-Key: bv_your_api_key"`} />
                </div>

                {/* Response */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Success Response
                    <Badge variant="outline" className="text-xs">200 OK</Badge>
                  </h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "success": true,
  "data": {
    "type": "email",
    "query": "john@example.com",
    "found": true,
    "summary": {
      "totalCredentials": 15,
      "uniqueDevices": 3,
      "firstSeen": "2024-01-01T00:00:00Z",
      "lastSeen": "2024-12-01T00:00:00Z",
      "topDomains": [
        {"domain": "example.com", "count": 10},
        {"domain": "test.com", "count": 5}
      ],
      "countries": [
        {"country": "US", "count": 8},
        {"country": "UK", "count": 7}
      ]
    }
  },
  "meta": {
    "checkedAt": "2024-01-22T10:30:00Z"
  }
}`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Upload Section */}
        {activeSection === "upload" && (
          <div className="space-y-6">
            {/* Admin Warning */}
            <Card className="glass-card border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Shield className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="text-sm text-amber-500">
                    <strong>Admin Role Required:</strong> Only API keys with admin role can access upload endpoints.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-mono">POST</Badge>
                  <code className="text-lg font-mono text-foreground">/api/v1/upload</code>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  Upload stealer logs in ZIP format. The file will be processed asynchronously.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parameters */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Form Data Parameters</h4>
                  <ParameterTable params={[
                    { name: "file", type: "file", required: true, description: "ZIP file containing stealer logs" },
                  ]} />
                </div>

                {/* Example Request */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl -X POST "${baseUrl}/api/v1/upload" \\
  -H "X-API-Key: bv_admin_api_key" \\
  -F "file=@stealer_logs.zip"`} />
                </div>

                {/* Response */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Success Response
                    <Badge variant="outline" className="text-xs">200 OK</Badge>
                  </h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "success": true,
  "message": "Upload processed successfully",
  "data": {
    "jobId": "job_abc123",
    "status": "completed",
    "stats": {
      "totalDevices": 10,
      "totalCredentials": 5000,
      "totalFiles": 150,
      "processingTime": 12500
    }
  }
}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Upload Jobs */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-mono">GET</Badge>
                  <code className="text-lg font-mono text-foreground">/api/v1/upload/jobs</code>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  List all upload jobs with their status and statistics.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Example Request */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl "${baseUrl}/api/v1/upload/jobs" \\
  -H "X-API-Key: bv_admin_api_key"`} />
                </div>

                {/* Job Statuses */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary" />
                    Job Status Values
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30">pending</Badge>
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">processing</Badge>
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">completed</Badge>
                    <Badge className="bg-red-500/10 text-red-400 border-red-500/30">failed</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Upload Status by Job ID */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-mono">GET</Badge>
                  <code className="text-lg font-mono text-foreground">/api/v1/upload/status/:jobId</code>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  Get detailed status of a specific upload job.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parameters */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Path Parameters</h4>
                  <ParameterTable params={[
                    { name: "jobId", type: "string", required: true, description: "The unique job identifier" },
                  ]} />
                </div>

                {/* Example Request */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl "${baseUrl}/api/v1/upload/status/job_abc123" \\
  -H "X-API-Key: bv_admin_api_key"`} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* API Keys Section */}
        {activeSection === "api-keys" && (
          <div className="space-y-6">
            {/* List API Keys */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 font-mono">GET</Badge>
                    <code className="text-lg font-mono text-foreground">/api/v1/api-keys</code>
                  </div>
                  <Link href="/api-keys">
                    <Button variant="outline" size="sm" className="glass-card border-border/50">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Manage Keys
                    </Button>
                  </Link>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  List all API keys. Analysts see only their own keys, admins see all keys.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl "${baseUrl}/api/v1/api-keys" \\
  -H "X-API-Key: bv_your_api_key"`} />
                </div>

                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Success Response
                    <Badge variant="outline" className="text-xs">200 OK</Badge>
                  </h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "success": true,
  "data": {
    "apiKeys": [
      {
        "id": 1,
        "name": "My Integration",
        "keyPrefix": "bv_abc123",
        "role": "analyst",
        "rateLimit": 100,
        "rateLimitWindow": 60,
        "isActive": true,
        "expiresAt": null,
        "lastUsedAt": "2024-01-20T15:30:00Z",
        "createdAt": "2024-01-01T10:00:00Z"
      }
    ]
  }
}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Create API Key */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30 font-mono">POST</Badge>
                  <code className="text-lg font-mono text-foreground">/api/v1/api-keys</code>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  Create a new API key. The full key is only returned once.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parameters */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Request Body Parameters</h4>
                  <ParameterTable params={[
                    { name: "name", type: "string", required: true, description: "A descriptive name for the API key" },
                    { name: "role", type: "string", required: false, description: "Key role: analyst or admin", default: "analyst" },
                    { name: "rateLimit", type: "number", required: false, description: "Max requests per window", default: "100" },
                    { name: "rateLimitWindow", type: "number", required: false, description: "Time window in seconds", default: "60" },
                  ]} />
                </div>

                {/* Example Request */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl -X POST "${baseUrl}/api/v1/api-keys" \\
  -H "X-API-Key: bv_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"name": "My Integration", "role": "analyst", "rateLimit": 100, "rateLimitWindow": 60}'`} />
                </div>

                {/* Response */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Success Response
                    <Badge variant="outline" className="text-xs">201 Created</Badge>
                  </h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "success": true,
  "message": "API key created successfully. Save this key - it will not be shown again!",
  "data": {
    "apiKey": "bv_newkeyhere123456789012345678",
    "keyInfo": {
      "id": 123,
      "name": "My Integration",
      "keyPrefix": "bv_newkey",
      "role": "analyst",
      "rateLimit": 100,
      "rateLimitWindow": 60
    }
  }
}`}
                  />
                  <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
                    <p className="text-sm text-amber-500 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      The full API key is only shown once. Store it securely.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Delete API Key */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-red-500/10 text-red-400 border-red-500/30 font-mono">DELETE</Badge>
                  <code className="text-lg font-mono text-foreground">/api/v1/api-keys/:id</code>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  Delete an API key. This action cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parameters */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Path Parameters</h4>
                  <ParameterTable params={[
                    { name: "id", type: "number", required: true, description: "The ID of the API key to delete" },
                  ]} />
                </div>

                {/* Example Request */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl -X DELETE "${baseUrl}/api/v1/api-keys/123" \\
  -H "X-API-Key: bv_your_api_key"`} />
                </div>

                {/* Response */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    Success Response
                    <Badge variant="outline" className="text-xs">200 OK</Badge>
                  </h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "success": true,
  "message": "API key deleted successfully"
}`}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Toggle API Key Status */}
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Badge className="bg-orange-500/10 text-orange-400 border-orange-500/30 font-mono">PATCH</Badge>
                  <code className="text-lg font-mono text-foreground">/api/v1/api-keys/:id</code>
                </div>
                <CardDescription className="text-muted-foreground mt-2">
                  Update API key status (activate/deactivate).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Parameters */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Path Parameters</h4>
                  <ParameterTable params={[
                    { name: "id", type: "number", required: true, description: "The ID of the API key to update" },
                  ]} />
                </div>

                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Request Body Parameters</h4>
                  <ParameterTable params={[
                    { name: "isActive", type: "boolean", required: true, description: "Set to true to activate, false to deactivate" },
                  ]} />
                </div>

                {/* Example Request */}
                <div>
                  <h4 className="font-semibold mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl -X PATCH "${baseUrl}/api/v1/api-keys/123" \\
  -H "X-API-Key: bv_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"isActive": false}'`} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
