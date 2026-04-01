"use client"

import { useState, useEffect } from "react"
import { Save, RefreshCw, Plus, Trash2, Rss, ChevronRight, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"

export function FeedConfigurationTab() {
  const { toast } = useToast()
  
  // States
  const [loading, setLoading] = useState(true)
  const [savingInterval, setSavingInterval] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [interval, setSyncInterval] = useState(60)
  
  const [categories, setCategories] = useState<any[]>([])
  const [sources, setSources] = useState<any[]>([])
  
  // Form states
  const [newCatName, setNewCatName] = useState("")
  const [newCatSlug, setNewCatSlug] = useState("")
  
  const [editingCatId, setEditingCatId] = useState<number | null>(null)
  const [editCatName, setEditCatName] = useState("")
  const [editCatSlug, setEditCatSlug] = useState("")
  
  const [newSourceName, setNewSourceName] = useState("")
  const [newSourceUrl, setNewSourceUrl] = useState("")
  const [selectedCatId, setSelectedCatId] = useState<number | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async (forceSelectCatId?: number) => {
    try {
      setLoading(true)
      
      // Load interval setting
      const resSettings = await fetch("/api/settings?prefix=feed_sync_interval")
      if (resSettings.ok) {
        const data = await resSettings.json()
        if (data.settings && data.settings.feed_sync_interval) {
          setSyncInterval(parseInt(data.settings.feed_sync_interval))
        }
      }

      // Load Categories and Sources
      const resCats = await fetch("/api/feeds/categories")
      if (resCats.ok) {
        const catData = await resCats.json()
        const fetchedCats = catData.categories || []
        setCategories(fetchedCats)
        
        if (forceSelectCatId) {
          setSelectedCatId(forceSelectCatId)
        } else if (fetchedCats.length > 0) {
          setSelectedCatId(prev => {
            if (!prev || !fetchedCats.find((c: any) => c.id === prev)) {
              return fetchedCats[0].id
            }
            return prev
          })
        } else {
          setSelectedCatId(null)
        }
      }

      const resSrcs = await fetch("/api/feeds/sources")
      if (resSrcs.ok) {
        const srcData = await resSrcs.json()
        setSources(srcData.sources || [])
      }

    } catch (error) {
      console.error("Failed to load feed data", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSaveInterval = async () => {
    setSavingInterval(true)
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key_name: "feed_sync_interval", value: interval.toString() })
      })
      if (res.ok) {
        toast({ title: "Success", description: "Sync interval updated successfully." })
      } else {
        throw new Error("Failed to save")
      }
    } catch (_error) {
      toast({ title: "Error", description: "Could not update setting.", variant: "destructive" })
    } finally {
      setSavingInterval(false)
    }
  }

  const handleFetchNow = async () => {
    setSyncing(true)
    try {
      const res = await fetch("/api/feeds/sync", {
        method: "POST"
      })
      const data = await res.json()
      if (res.ok) {
        toast({ title: "Sync Complete", description: data.message })
        await loadData() // Refresh sources to show new last_fetched_at dates
      } else {
        throw new Error(data.error || "Sync failed")
      }
    } catch (error: any) {
      toast({ title: "Sync Error", description: error.message, variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }

  const handleAddCategory = async () => {
    if (!newCatName || !newCatSlug) return
    try {
      const res = await fetch("/api/feeds/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCatName, slug: newCatSlug })
      })
      if (res.ok) {
        const data = await res.json()
        setNewCatName("")
        setNewCatSlug("")
        toast({ title: "Success", description: "Category created" })
        loadData(data.id)
        setTimeout(() => window.location.reload(), 500)
      } else {
        const data = await res.json()
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleEditCategory = async (id: number) => {
    if (!editCatName || !editCatSlug) return
    try {
      const res = await fetch("/api/feeds/categories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: editCatName, slug: editCatSlug })
      })
      if (res.ok) {
        setEditingCatId(null)
        toast({ title: "Success", description: "Category updated" })
        loadData(id)
        setTimeout(() => window.location.reload(), 500)
      } else {
        const data = await res.json()
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Delete this category? All its feeds will be deleted!")) return
    try {
      const res = await fetch(`/api/feeds/categories?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Success", description: "Category deleted" })
        loadData()
        setTimeout(() => window.location.reload(), 500)
      }
    } catch (_error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  const handleAddSource = async () => {
    if (!selectedCatId || !newSourceName || !newSourceUrl) return
    try {
      const res = await fetch("/api/feeds/sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_id: selectedCatId, name: newSourceName, rss_url: newSourceUrl })
      })
      if (res.ok) {
        setNewSourceName("")
        setNewSourceUrl("")
        toast({ title: "Success", description: "Feed source added" })
        loadData()
      } else {
        const data = await res.json()
        throw new Error(data.error)
      }
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" })
    }
  }

  const handleDeleteSource = async (id: number) => {
    if (!confirm("Delete this feed source?")) return
    try {
      const res = await fetch(`/api/feeds/sources?id=${id}`, { method: "DELETE" })
      if (res.ok) {
        toast({ title: "Success", description: "Source deleted" })
        loadData()
      }
    } catch (_error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" })
    }
  }

  const filteredSources = sources.filter(s => s.category_id === selectedCatId)
  const activeCategory = categories.find(c => c.id === selectedCatId)

  if (loading) return <div className="p-8 text-center text-muted-foreground animate-pulse">Loading Feed Configuration...</div>

  return (
    <div className="space-y-6">
      {/* Sync Configuration Card */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-foreground">Sync Configuration</CardTitle>
          <CardDescription className="text-muted-foreground">
            Configure how often the server automatically fetches background RSS feeds, or force a fetch now.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Background Sync Interval (Minutes)</Label>
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center">
              <div className="flex-1">
                <Input 
                  type="number" 
                  value={interval} 
                  onChange={e => setSyncInterval(parseInt(e.target.value) || 60)} 
                  className="glass-card" 
                />
              </div>
              <div className="flex gap-3">
                <Button onClick={handleSaveInterval} disabled={savingInterval}>
                  <Save className="h-4 w-4 mr-2" /> {savingInterval ? "Saving..." : "Save Config"}
                </Button>
                <Button variant="secondary" onClick={handleFetchNow} disabled={syncing}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? 'animate-spin' : ''}`} /> 
                  {syncing ? "Fetching Feeds..." : "Fetch Feeds Now"}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Checked transparently during user activity. Recommended: 60.</p>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] xl:grid-cols-[350px_1fr] gap-6 items-start">
        {/* Category Management (Master) */}
        <Card className="glass-card h-fit sticky top-6">
          <CardHeader className="pb-4">
            <CardTitle>Feed Categories</CardTitle>
            <CardDescription>Select a category to manage its sources.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
              <span className="text-xs font-semibold text-muted-foreground mb-1 uppercase tracking-wider">New Category</span>
              <Input placeholder="Name (e.g. Threat Intel)" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="h-8 text-sm bg-background/50 border-white/10" />
              <div className="flex gap-2">
                <Input placeholder="Slug (e.g. threat-intel)" value={newCatSlug} onChange={e => setNewCatSlug(e.target.value)} className="h-8 text-sm flex-1 bg-background/50 border-white/10" />
                <Button onClick={handleAddCategory} size="sm" className="h-8 w-8 px-0 shrink-0"><Plus className="h-4 w-4" /></Button>
              </div>
            </div>
            
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1 mt-2">
              {categories.map(cat => {
                const isActive = cat.id === selectedCatId
                const isEditing = cat.id === editingCatId

                if (isEditing) {
                  return (
                    <div key={cat.id} className="flex flex-col gap-2 p-3 bg-white/10 rounded-lg border border-primary/30 shadow-sm shadow-primary/5">
                      <Input value={editCatName} onChange={e => setEditCatName(e.target.value)} className="h-8 text-sm bg-background/80 border-white/10" placeholder="Category Name" />
                      <Input value={editCatSlug} onChange={e => setEditCatSlug(e.target.value)} className="h-8 text-sm bg-background/80 border-white/10" placeholder="Category Slug" />
                      <div className="flex gap-2 justify-end mt-1">
                        <Button variant="ghost" size="sm" className="h-7 px-2.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10" onClick={() => setEditingCatId(null)}>Cancel</Button>
                        <Button size="sm" className="h-7 px-3 text-xs shadow" onClick={() => handleEditCategory(cat.id)}>Save</Button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div 
                    key={cat.id} 
                    onClick={() => setSelectedCatId(cat.id)}
                    className={`flex items-center justify-between p-3 rounded-lg border transition-all cursor-pointer group ${
                      isActive 
                        ? "bg-primary/10 border-primary/50 shadow-sm shadow-primary/10" 
                        : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                    }`}
                  >
                    <div className="flex flex-col overflow-hidden pr-2">
                       <span className={`font-semibold text-sm truncate flex items-center gap-1.5 ${isActive ? "text-primary" : "text-foreground group-hover:text-primary transition-colors"}`}>
                         {cat.name}
                         {isActive && <ChevronRight className="h-3 w-3 opacity-70" />}
                       </span>
                       <span className="text-[11px] text-muted-foreground truncate opacity-70 font-mono">/{cat.slug}</span>
                    </div>
                    <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditingCatId(cat.id);
                          setEditCatName(cat.name);
                          setEditCatSlug(cat.slug);
                        }} 
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat.id); }} 
                        className="h-7 w-7 shrink-0 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                )
              })}
              {categories.length === 0 && (
                <div className="text-center p-6 text-xs text-muted-foreground border border-dashed border-white/10 rounded-lg">
                  No categories found. Create one.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Source Management (Detail) */}
        <Card className="glass-card flex flex-col h-fit min-h-[500px]">
          <CardHeader className="pb-4 border-b border-border/50">
            <CardTitle className="flex items-center gap-2">
              <Rss className="h-5 w-5 text-primary" />
              {activeCategory ? `Sources for "${activeCategory.name}"` : "RSS Feed Sources"}
            </CardTitle>
            <CardDescription>
              {activeCategory 
                ? "Manage RSS endpoint URLs syncing for this category." 
                : "Please select a category from the left pane to view or add sources."}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 flex flex-col flex-1">
            {!activeCategory ? (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground opacity-50 p-12 h-full">
                <Rss className="h-16 w-16 mb-4 opacity-20" />
                <p className="font-medium text-lg">Select a Category</p>
                <p className="text-sm mt-1 max-w-sm text-center">Click on any category in the list on the left to manage its RSS feeds.</p>
              </div>
            ) : (
              <div className="flex flex-col h-full space-y-6">
                {/* Add new Source */}
                <div className="flex flex-col sm:flex-row gap-3 p-4 bg-primary/5 rounded-xl border border-primary/20">
                  <div className="flex-[1.5] space-y-1.5">
                    <Label className="text-[11px] text-primary/80 uppercase tracking-wider font-semibold">Publisher Name</Label>
                    <Input placeholder="e.g. Bleeping Computer" value={newSourceName} onChange={e => setNewSourceName(e.target.value)} className="bg-background/80 h-9 border-primary/20 focus:border-primary/50" />
                  </div>
                  <div className="flex-[2.5] space-y-1.5">
                    <Label className="text-[11px] text-primary/80 uppercase tracking-wider font-semibold">RSS / XML Endpoint URL</Label>
                    <div className="flex gap-2">
                      <Input placeholder="https://..." value={newSourceUrl} onChange={e => setNewSourceUrl(e.target.value)} className="bg-background/80 h-9 border-primary/20 focus:border-primary/50" />
                      <Button onClick={handleAddSource} disabled={!selectedCatId || !newSourceName || !newSourceUrl} className="h-9 shrink-0 shadow-md shadow-primary/20">
                        <Plus className="h-4 w-4 mr-1.5" /> Add
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Sources List */}
                <div className="space-y-3 overflow-y-auto pr-2" style={{ maxHeight: 'calc(100vh - 400px)', minHeight: '300px' }}>
                  {filteredSources.length === 0 ? (
                    <div className="text-center p-12 text-sm text-muted-foreground border border-dashed border-white/10 rounded-xl bg-white/5">
                      <Rss className="h-10 w-10 mx-auto mb-3 opacity-30" />
                      <p>No feed sources configured for <strong>{activeCategory.name}</strong> yet.</p>
                      <p className="text-xs mt-1">Add a valid RSS endpoint URL above to get started.</p>
                    </div>
                  ) : filteredSources.map(src => {
                    const isStale = !src.last_fetched_at 
                    return (
                      <div key={src.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl bg-white/[0.03] border border-white/10 hover:bg-white/[0.05] hover:border-primary/30 transition-all gap-4 group">
                        <div className="flex flex-col overflow-hidden max-w-full sm:max-w-[80%] space-y-1.5">
                          <span className="font-bold text-foreground text-[15px] truncate group-hover:text-primary transition-colors flex items-center">
                            {src.name}
                          </span>
                          <span className="text-[11px] text-muted-foreground truncate bg-black/20 w-fit px-2 py-0.5 rounded text-mono opacity-80 border border-white/5">
                            {src.rss_url}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="relative flex h-2 w-2">
                              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isStale ? "bg-amber-400" : "bg-emerald-400"}`}></span>
                              <span className={`relative inline-flex rounded-full h-2 w-2 ${isStale ? "bg-amber-500" : "bg-emerald-500"}`}></span>
                            </span>
                            <span className="text-[11px] font-medium text-muted-foreground">
                              {isStale ? "Pending first intelligent fetch" : `Last pulled: ${new Date(src.last_fetched_at).toLocaleString()}`}
                            </span>
                          </div>
                        </div>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          onClick={() => handleDeleteSource(src.id)} 
                          className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 border-transparent bg-transparent transition-all opacity-40 group-hover:opacity-100"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
