"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Copy, BookOpen, Key, Search, Upload, Database, Shield, Clock, Zap, CheckCircle2, AlertCircle, Terminal, Globe, FileJson, ArrowRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import Link from "next/link"

export default function DocsPage() {
  const { toast } = useToast()
  const [activeSection, setActiveSection] = useState("overview")

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copied",
      description: "Code copied to clipboard"
    })
  }

  const CodeBlock = ({ code, language = "bash" }: { code: string; language?: string }) => (
    <div className="relative group">
      <pre className="bg-muted/30 border border-border/50 p-4 rounded-lg text-sm overflow-x-auto font-mono">
        <code className={`language-${language}`}>{code}</code>
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

  const Endpoint = ({ method, path, description, role }: { 
    method: string; 
    path: string; 
    description: string;
    role?: string;
  }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/20 border border-border/30 hover:bg-muted/30 transition-colors">
      <Badge 
        variant="outline" 
        className={`font-mono text-xs shrink-0 ${
          method === "GET" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" :
          method === "POST" ? "bg-blue-500/10 text-blue-400 border-blue-500/30" :
          method === "PUT" ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30" :
          method === "PATCH" ? "bg-orange-500/10 text-orange-400 border-orange-500/30" :
          method === "DELETE" ? "bg-red-500/10 text-red-400 border-red-500/30" :
          ""
        }`}
      >
        {method}
      </Badge>
      <div className="flex-1 min-w-0">
        <code className="text-sm font-mono text-foreground break-all">{path}</code>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {role && (
        <Badge variant="outline" className={`text-xs shrink-0 ${
          role === "admin" ? "bg-amber-500/10 text-amber-500 border-amber-500/30" : "bg-primary/10 text-primary border-primary/30"
        }`}>
          {role}
        </Badge>
      )}
    </div>
  )

  const sections = [
    { id: "overview", label: "Overview", icon: BookOpen },
    { id: "auth", label: "Authentication", icon: Key },
    { id: "search", label: "Search API", icon: Search },
    { id: "lookup", label: "Lookup API", icon: Database },
    { id: "upload", label: "Upload API", icon: Upload },
    { id: "api-keys", label: "API Keys", icon: Shield },
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
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Overview Section */}
        {activeSection === "overview" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <Card className="glass-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-emerald-500/10">
                      <Globe className="h-5 w-5 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Base URL</p>
                      <code className="text-sm font-mono text-foreground">/api/v1</code>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/10">
                      <FileJson className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Format</p>
                      <p className="text-sm font-medium text-foreground">JSON</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="glass-card border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Auth</p>
                      <p className="text-sm font-medium text-foreground">API Key</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-primary" />
                  Response Format
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                      <span className="text-sm font-medium text-foreground">Success Response</span>
                    </div>
                    <CodeBlock 
                      language="json"
                      code={`{
  "success": true,
  "data": { ... },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 50
  }
}`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium text-foreground">Error Response</span>
                    </div>
                    <CodeBlock 
                      language="json"
                      code={`{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}`}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">Available Endpoints</CardTitle>
                <CardDescription className="text-muted-foreground">All available API endpoints</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Endpoint method="POST" path="/api/v1/search/credentials" description="Search credentials by email, username, or password" role="analyst+" />
                <Endpoint method="POST" path="/api/v1/search/domain" description="Search all data for a specific domain" role="analyst+" />
                <Endpoint method="POST" path="/api/v1/search/bulk" description="Bulk search for multiple queries at once" role="analyst+" />
                <Endpoint method="GET" path="/api/v1/lookup?email=..." description="Quick lookup by email address" role="analyst+" />
                <Endpoint method="GET" path="/api/v1/lookup?domain=..." description="Quick lookup by domain" role="analyst+" />
                <Endpoint method="POST" path="/api/v1/upload" description="Upload stealer logs (ZIP file)" role="admin" />
                <Endpoint method="GET" path="/api/v1/upload/jobs" description="List upload jobs" role="admin" />
                <Endpoint method="GET" path="/api/v1/api-keys" description="List API keys" role="analyst+" />
                <Endpoint method="POST" path="/api/v1/api-keys" description="Create new API key" role="analyst+" />
                <Endpoint method="DELETE" path="/api/v1/api-keys/:id" description="Delete API key" role="analyst+" />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Authentication Section */}
        {activeSection === "auth" && (
          <div className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Key className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground">API Key Authentication</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Include your API key in the X-API-Key header
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3 text-foreground">Example Request</h4>
                  <CodeBlock code={`curl -X POST "https://your-domain.com/api/v1/search/credentials" \\
  -H "X-API-Key: bv_your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "example@email.com", "type": "email"}'`} />
                </div>

                <div>
                  <h4 className="font-medium mb-3 text-foreground">API Key Format</h4>
                  <div className="p-4 rounded-lg bg-muted/20 border border-border/30">
                    <code className="font-mono text-sm text-foreground">bv_</code>
                    <span className="text-muted-foreground text-sm"> + 32 random characters</span>
                    <p className="text-xs text-muted-foreground mt-2">
                      Example: <code className="bg-muted/50 px-1 rounded">bv_a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6</code>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Shield className="h-5 w-5 text-primary" />
                  Role-Based Access
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/30">
                      <Zap className="h-3 w-3 mr-1" />
                      Analyst
                    </Badge>
                    <span className="text-sm font-medium text-foreground">Read-only Access</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Can search credentials, lookup data, and manage own API keys
                  </p>
                </div>
                <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-3 mb-2">
                    <Badge className="bg-primary/10 text-primary border-primary/30">
                      <Shield className="h-3 w-3 mr-1" />
                      Admin
                    </Badge>
                    <span className="text-sm font-medium text-foreground">Full Access</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    All analyst permissions plus upload data and manage all API keys
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Rate Limiting
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Rate limits are configured per API key. Response headers include rate limit information:
                </p>
                <div className="space-y-2">
                  {[
                    { header: "X-RateLimit-Limit", desc: "Maximum requests per window" },
                    { header: "X-RateLimit-Remaining", desc: "Remaining requests in current window" },
                    { header: "X-RateLimit-Reset", desc: "Unix timestamp when window resets" },
                  ].map((item) => (
                    <div key={item.header} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20">
                      <code className="text-xs font-mono bg-muted/50 px-2 py-1 rounded">{item.header}</code>
                      <span className="text-sm text-muted-foreground">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search API Section */}
        {activeSection === "search" && (
          <div className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10">
                    <Search className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground">Search Credentials</CardTitle>
                    <CardDescription className="text-muted-foreground">POST /api/v1/search/credentials</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2 text-foreground">Request Body</h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "query": "example@email.com",
  "type": "email",        // email, username, password, any
  "page": 1,
  "limit": 50,
  "includePasswords": false
}`}
                  />
                </div>

                <div>
                  <h4 className="font-medium mb-2 text-foreground">Example</h4>
                  <CodeBlock code={`curl -X POST "https://your-domain.com/api/v1/search/credentials" \\
  -H "X-API-Key: bv_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"query": "john@example.com", "type": "email"}'`} />
                </div>

                <div>
                  <h4 className="font-medium mb-2 text-foreground">Response</h4>
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
              </CardContent>
            </Card>

            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">Search by Domain</CardTitle>
                <CardDescription className="text-muted-foreground">POST /api/v1/search/domain</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock 
                  language="json"
                  code={`{
  "domain": "example.com",
  "includeSubdomains": true,
  "page": 1,
  "limit": 50
}`}
                />
                <CodeBlock code={`curl -X POST "https://your-domain.com/api/v1/search/domain" \\
  -H "X-API-Key: bv_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{"domain": "example.com", "includeSubdomains": true}'`} />
              </CardContent>
            </Card>

            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground">Bulk Search</CardTitle>
                <CardDescription className="text-muted-foreground">POST /api/v1/search/bulk</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <CodeBlock 
                  language="json"
                  code={`{
  "queries": [
    { "query": "john@example.com", "type": "email" },
    { "query": "jane@example.com", "type": "email" },
    { "query": "admin", "type": "username" }
  ],
  "limit": 10
}`}
                />
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lookup API Section */}
        {activeSection === "lookup" && (
          <div className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-emerald-500/10">
                    <Database className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground">Quick Lookup</CardTitle>
                    <CardDescription className="text-muted-foreground">
                      Fast lookups with summary statistics - no full credential data
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-3 text-foreground flex items-center gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">GET</Badge>
                    Email Lookup
                  </h4>
                  <CodeBlock code={`curl "https://your-domain.com/api/v1/lookup?email=john@example.com" \\
  -H "X-API-Key: bv_your_api_key"`} />
                </div>

                <div>
                  <h4 className="font-medium mb-3 text-foreground flex items-center gap-2">
                    <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">GET</Badge>
                    Domain Lookup
                  </h4>
                  <CodeBlock code={`curl "https://your-domain.com/api/v1/lookup?domain=example.com" \\
  -H "X-API-Key: bv_your_api_key"`} />
                </div>

                <div>
                  <h4 className="font-medium mb-3 text-foreground">Response</h4>
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
        { "domain": "example.com", "count": 10 },
        { "domain": "test.com", "count": 5 }
      ],
      "countries": [
        { "country": "US", "count": 8 },
        { "country": "UK", "count": 7 }
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

        {/* Upload API Section */}
        {activeSection === "upload" && (
          <div className="space-y-6">
            <Card className="glass-card border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10">
                    <Shield className="h-5 w-5 text-amber-500" />
                  </div>
                  <p className="text-sm text-amber-500">
                    <strong>Admin Role Required:</strong> Only API keys with admin role can upload data.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-blue-500/10">
                    <Upload className="h-5 w-5 text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-foreground">Upload Stealer Logs</CardTitle>
                    <CardDescription className="text-muted-foreground">POST /api/v1/upload</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2 text-foreground">Upload ZIP File</h4>
                  <CodeBlock code={`curl -X POST "https://your-domain.com/api/v1/upload" \\
  -H "X-API-Key: bv_admin_api_key" \\
  -F "file=@stealer_logs.zip"`} />
                </div>

                <div>
                  <h4 className="font-medium mb-2 text-foreground">Response</h4>
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

            <Card className="glass-card border-border/50">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Job Status
                </CardTitle>
                <CardDescription className="text-muted-foreground">GET /api/v1/upload/status/:jobId</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {[
                    { status: "pending", color: "amber", desc: "Queued" },
                    { status: "processing", color: "blue", desc: "Processing" },
                    { status: "completed", color: "emerald", desc: "Done" },
                    { status: "failed", color: "red", desc: "Error" },
                  ].map((item) => (
                    <Badge key={item.status} variant="outline" className={`bg-${item.color}-500/10 text-${item.color}-500 border-${item.color}-500/30`}>
                      {item.status}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* API Keys Section */}
        {activeSection === "api-keys" && (
          <div className="space-y-6">
            <Card className="glass-card border-border/50">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10">
                      <Key className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-foreground">API Key Management</CardTitle>
                      <CardDescription className="text-muted-foreground">Manage API keys programmatically</CardDescription>
                    </div>
                  </div>
                  <Link href="/api-keys">
                    <Button variant="outline" size="sm" className="glass-card border-border/50">
                      <ArrowRight className="h-4 w-4 mr-2" />
                      Manage Keys
                    </Button>
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-medium mb-2 text-foreground">List API Keys</h4>
                  <CodeBlock code={`curl "https://your-domain.com/api/v1/api-keys" \\
  -H "X-API-Key: bv_your_api_key"`} />
                </div>

                <div>
                  <h4 className="font-medium mb-2 text-foreground">Create New API Key</h4>
                  <CodeBlock code={`curl -X POST "https://your-domain.com/api/v1/api-keys" \\
  -H "X-API-Key: bv_your_api_key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "My Integration",
    "role": "analyst",
    "rateLimit": 100,
    "rateLimitWindow": 60
  }'`} />
                </div>

                <div>
                  <h4 className="font-medium mb-2 text-foreground">Response</h4>
                  <CodeBlock 
                    language="json"
                    code={`{
  "success": true,
  "message": "API key created successfully",
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

                <div>
                  <h4 className="font-medium mb-2 text-foreground">Delete API Key</h4>
                  <CodeBlock code={`curl -X DELETE "https://your-domain.com/api/v1/api-keys/123" \\
  -H "X-API-Key: bv_your_api_key"`} />
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </main>
  )
}
