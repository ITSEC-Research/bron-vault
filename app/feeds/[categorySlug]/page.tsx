"use client"

import { useEffect, useState, useMemo, useRef } from "react"
import { useParams } from "next/navigation"
import { ExternalLink, Calendar, Search, Newspaper, Activity, Loader2, User, LayoutGrid, List, ChevronLeft, ChevronRight, X, Info, SlidersHorizontal, Plus, Trash2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card"
import { DashboardDateRange } from "@/components/dashboard-date-range"
import { DateRangeType, dateRangeToQueryParams } from "@/lib/date-range-utils"

interface Article {
  id: number
  guid: string
  title: string
  link: string
  description: string
  author: string | null
  thumbnail_url: string | null
  pub_date: string
  created_at: string
  source_name: string
  category_name: string
  source_id: number
  source_total?: number
}

interface GroupState {
  page: number
  totalPages: number
  articles: Article[]
  loading: boolean
}

const SourceIcon = ({ url, name }: { url?: string; name: string }) => {
  const [error, setError] = useState(false)
  let domain = ""
  try {
    if (url) domain = new URL(url).hostname
  } catch (e) {}

  if (!domain || error) {
    return <Activity className="h-3.5 w-3.5 opacity-70" />
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  const proxyUrl = `/api/feeds/image-proxy?url=${encodeURIComponent(faviconUrl)}`

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={proxyUrl}
      alt={name}
      className="w-full h-full object-contain p-[3px] rounded"
      onError={() => setError(true)}
    />
  )
}

export default function NewsFeedPage() {
  const params = useParams()
  const categorySlug = params.categorySlug as string
  
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [dateRange, setDateRange] = useState<DateRangeType | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [categoryName, setCategoryName] = useState("Loading...")
  const [viewMode, setViewMode] = useState<'timeline' | 'grouped'>('timeline')
  const [groupState, setGroupState] = useState<Record<string, GroupState>>({})

  // Advanced Search Builder
  type AdvRow = { id: string, term: string, operator: 'AND' | 'OR' }
  const [advRows, setAdvRows] = useState<AdvRow[]>([{ id: '1', term: '', operator: 'AND' }])
  const [advModalOpen, setAdvModalOpen] = useState(false)

  const handleApplyAdvancedSearch = () => {
    let q = ""
    advRows.forEach((row, idx) => {
      if (!row.term.trim()) return
      const cleanTerm = row.term.trim().replace(/"/g, '')
      const formattedTerm = `"${cleanTerm}"`
      if (q === "") {
        q += formattedTerm
      } else {
        q += ` ${row.operator} ${formattedTerm}`
      }
    })
    setSearch(q)
    setAdvModalOpen(false)
    setPage(1)
    fetchArticles(q)
  }

  useEffect(() => {
    const saved = localStorage.getItem('bron_feed_view_mode')
    if (saved === 'grouped' || saved === 'timeline') {
      setViewMode(saved as 'timeline' | 'grouped')
    }
  }, [])

  const fetchIdRef = useRef(0)

  useEffect(() => {
    fetchArticles()
    // Trigger polling every 5 minutes while page is open (optional, keeps it fresh)
    const interval = setInterval(fetchArticles, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [categorySlug, page, viewMode])

  const fetchArticles = async (
    overrideSearch?: string, 
    overrideClearDate?: boolean,
    overrideDateRange?: DateRangeType | null
  ) => {
    const currentFetchId = ++fetchIdRef.current
    try {
      setLoading(true)
      const searchQuery = overrideSearch !== undefined ? overrideSearch : search
      let url = `/api/feeds/articles?category_slug=${categorySlug}&page=${page}&limit=18&q=${encodeURIComponent(searchQuery)}`
      
      if (viewMode === 'grouped') {
        url += `&view=grouped`
      }

      const activeDateRange = overrideClearDate 
        ? null 
        : (overrideDateRange !== undefined ? overrideDateRange : dateRange)
      const dateParams = dateRangeToQueryParams(activeDateRange)
      if (dateParams.startDate) url += `&startDate=${dateParams.startDate}`
      if (dateParams.endDate) url += `&endDate=${dateParams.endDate}`

      const res = await fetch(url)
      if (res.ok) {
        if (fetchIdRef.current !== currentFetchId) return // Ignore stale response
        const data = await res.json()
        setArticles(data.articles || [])
        setTotalPages(data.pagination.totalPages || 1)
        if (data.articles && data.articles.length > 0) {
          setCategoryName(data.articles[0].category_name)
        } else {
          setCategoryName(categorySlug.replace(/[^a-zA-Z0-9]/g, ' ').toUpperCase())
        }
      }
    } catch (error) {
      console.error("Failed to fetch articles:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setPage(1)
    fetchArticles(search)
  }

  const handleClearFilters = () => {
    setSearch("")
    setDateRange(null)
    setPage(1)
    fetchArticles("", true)
  }

  const handleViewModeToggle = (mode: 'timeline' | 'grouped') => {
    setViewMode(mode)
    localStorage.setItem('bron_feed_view_mode', mode)
    setPage(1) // Reset pagination when switching views
  }

  // Populate groupState from initial bulk load
  useEffect(() => {
    if (viewMode !== 'grouped' || articles.length === 0) return
    const groups: Record<string, Article[]> = {}
    articles.forEach(article => {
      const key = article.source_name
      if (!groups[key]) groups[key] = []
      groups[key].push(article)
    })
    const newState: Record<string, GroupState> = {}
    Object.entries(groups).forEach(([name, arts]) => {
      const sourceTotal = arts[0]?.source_total || arts.length
      newState[name] = {
        page: 1,
        totalPages: Math.ceil(sourceTotal / 7),
        articles: arts,
        loading: false
      }
    })
    setGroupState(newState)
  }, [articles, viewMode])

  const groupedArticles = useMemo(() => {
    if (viewMode !== 'grouped') return []
    return Object.keys(groupState).sort().map(sourceName => ({
      sourceName,
      ...groupState[sourceName]
    }))
  }, [groupState, viewMode])

  const handleGroupPage = async (sourceName: string, sourceId: number, newPage: number) => {
    setGroupState(prev => ({
      ...prev,
      [sourceName]: { ...prev[sourceName], loading: true }
    }))
    try {
      let url = `/api/feeds/articles?view=grouped&source_id=${sourceId}&group_page=${newPage}&category_slug=${categorySlug}&q=${encodeURIComponent(search)}`
      const dateParams = dateRangeToQueryParams(dateRange)
      if (dateParams.startDate) url += `&startDate=${dateParams.startDate}`
      if (dateParams.endDate) url += `&endDate=${dateParams.endDate}`
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setGroupState(prev => ({
          ...prev,
          [sourceName]: {
            page: newPage,
            totalPages: data.pagination.totalPages,
            articles: data.articles || [],
            loading: false
          }
        }))
      }
    } catch (err) {
      console.error('Failed to fetch group page:', err)
      setGroupState(prev => ({
        ...prev,
        [sourceName]: { ...prev[sourceName], loading: false }
      }))
    }
  }

  // Helper to strip excessively long HTML descriptions and clean them up visually
  const renderDescription = (desc: string) => {
    if (!desc) return null
    // Strip common HTML tags out if they somehow leaked through, 
    // though the backend cleans them up.
    let clean = desc.replace(/<[^>]*>?/gm, ' ').slice(0, 250)
    if (desc.length > 250) clean += "..."
    return clean
  }

  return (
    <main className="flex-1 p-6 relative min-h-screen">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-primary/80 mb-2">
              <Activity className="h-5 w-5" />
              <span className="text-sm font-semibold tracking-wider uppercase">Threat Intelligence Feed</span>
            </div>
            <h1 className="text-4xl font-bold text-foreground flex items-center gap-3">
              <Newspaper className="h-10 w-10 text-primary" />
              {categoryName}
            </h1>
            <p className="text-muted-foreground mt-2 max-w-2xl">
              Real-time updates from your security and intelligence sources.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0 items-start md:items-center justify-end">
            <div className="flex bg-background/50 glass-card rounded-md p-1 h-9 items-center shrink-0 border border-border">
              <button 
                type="button"
                onClick={() => handleViewModeToggle('timeline')}
                className={`p-1.5 rounded-sm transition-all text-xs font-medium flex items-center gap-1.5 ${viewMode === 'timeline' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                title="Feed View"
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline px-1">Feed</span>
              </button>
              <button 
                type="button"
                onClick={() => handleViewModeToggle('grouped')}
                className={`p-1.5 rounded-sm transition-all text-xs font-medium flex items-center gap-1.5 ${viewMode === 'grouped' ? 'bg-primary/20 text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'}`}
                title="Compact View"
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline px-1">Compact</span>
              </button>
            </div>

            <DashboardDateRange
              value={dateRange}
              onChange={(newDate) => {
                setDateRange(newDate)
                setPage(1)
                fetchArticles(undefined, false, newDate)
              }}
              className="w-full md:w-[260px] glass-card bg-background/50 border-white/10 shrink-0"
              align="center"
            />
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative w-full transition-all duration-300 md:w-[200px] focus-within:md:w-[250px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                <Input 
                  placeholder="Search topics..." 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-9 glass-card bg-background/50 border-white/10 w-full h-9"
                />
                <Dialog open={advModalOpen} onOpenChange={setAdvModalOpen}>
                  <DialogTrigger asChild>
                    <button className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md hover:bg-primary/20 text-muted-foreground hover:text-primary transition-colors focus:outline-none">
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[450px]">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /> Advanced Search Builder</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      {advRows.map((row, idx) => (
                        <div key={row.id} className="flex gap-2 items-center">
                          {idx > 0 ? (
                            <Select 
                               value={row.operator} 
                               onValueChange={v => {
                                  const n = [...advRows];
                                  n[idx].operator = v as 'AND'|'OR';
                                  setAdvRows(n)
                               }}
                            >
                              <SelectTrigger className="w-[85px] h-9 shrink-0">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AND">AND</SelectItem>
                                <SelectItem value="OR">OR</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <div className="w-[85px] text-xs font-medium text-muted-foreground uppercase text-center shrink-0">Match</div>
                          )}
                          <Input 
                            placeholder={idx === 0 ? "e.g. Ransomware" : "Keyword..."} 
                            value={row.term}
                            onChange={e => {
                               const n = [...advRows];
                               n[idx].term = e.target.value;
                               setAdvRows(n);
                            }}
                            className="h-9 flex-1"
                          />
                          {idx > 0 && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-9 w-9 text-muted-foreground hover:text-destructive shrink-0" 
                              onClick={() => setAdvRows(advRows.filter(r => r.id !== row.id))}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                      <Button 
                         variant="outline" 
                         size="sm" 
                         className="w-full h-8 mt-2 border-dashed text-primary/80 hover:text-primary"
                         onClick={() => setAdvRows([...advRows, { id: Math.random().toString(), term: '', operator: 'AND' }])}
                      >
                         <Plus className="h-4 w-4 mr-1.5" /> Add Keyword
                      </Button>
                      <p className="text-xs text-muted-foreground text-center opacity-80 pt-2">
                        Your inputs will be safely quoted to prevent search logic ambiguity.
                      </p>
                    </div>
                    <DialogFooter>
                      <Button variant="ghost" onClick={() => setAdvRows([{ id: '1', term: '', operator: 'AND' }])} className="mr-auto text-muted-foreground">Reset</Button>
                      <Button onClick={handleApplyAdvancedSearch}>Apply Search</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
              <Button type="submit" size="sm" className="h-9 glass-card hover:bg-primary/20 bg-primary/10 text-primary border-primary/20 w-full sm:w-auto shrink-0">
                Filter
              </Button>
              {(search || dateRange) && (
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={handleClearFilters}
                  className="h-9 w-9 p-0 glass-card bg-background/50 hover:bg-destructive/10 text-muted-foreground hover:text-destructive border-border/50 shrink-0"
                  title="Clear filters"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </form>
        </div>

        {/* Content Grid */}
        {loading && articles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="animate-pulse">Aggregating live intel...</p>
          </div>
        ) : articles.length === 0 ? (
          <Card className="glass-card border-dashed bg-background/30 p-12 text-center">
            <Newspaper className="h-12 w-12 text-muted-foreground opacity-50 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-foreground mb-2">No Articles Found</h3>
            <p className="text-muted-foreground">Try adjusting your search terms or wait for the next sync cycle.</p>
          </Card>
        ) : viewMode === 'grouped' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-start">
            {groupedArticles.map(group => (
              <Card key={group.sourceName} className="glass-card overflow-hidden shadow-sm hover:shadow-[0_0_20px_-5px_var(--tw-shadow-color)] shadow-primary/10 transition-shadow flex flex-col hover:border-primary/50">
                <div className="bg-primary/5 border-b border-primary/20 px-4 py-3 flex items-center gap-3">
                  <h3 className="font-bold text-foreground text-sm truncate uppercase tracking-wide flex-1" title={group.sourceName}>
                    {group.sourceName}
                  </h3>
                </div>
                <CardContent className="p-0">
                  <ul className="divide-y divide-border/30">
                    {group.articles.map(article => {
                      return (
                      <li key={article.id} className="group/item relative hover:bg-primary/5 transition-colors duration-200">
                        <HoverCard openDelay={400} closeDelay={100}>
                          <HoverCardTrigger asChild>
                            <a href={article.link} target="_blank" rel="noopener noreferrer" className="block py-2.5 focus:outline-none focus-visible:ring-2 ring-primary px-3.5">
                              <div className="flex items-center gap-3">
                                <div className="w-5 h-5 rounded flex flex-col items-center justify-center text-primary/70 shrink-0">
                                  <SourceIcon url={article.link} name={group.sourceName} />
                                </div>
                                <h4 className="flex-1 min-w-0 text-[13px] font-medium text-foreground/90 group-hover/item:text-primary leading-none truncate transition-colors">
                                  {article.title}
                                </h4>
                                <span className="text-[10px] font-medium text-muted-foreground/80 whitespace-nowrap pt-px shrink-0">
                                  {new Date(article.pub_date || article.created_at).toLocaleDateString(undefined, {
                                    month: 'short', day: 'numeric'
                                  })}
                                </span>
                              </div>
                            </a>
                          </HoverCardTrigger>
                          <HoverCardContent side="right" align="start" sideOffset={10} className="w-[320px] p-0 overflow-hidden shadow-2xl border-primary/20 z-[100] bg-background/95 backdrop-blur-md">
                            {article.thumbnail_url && article.thumbnail_url.startsWith('http') && (
                              <div className="w-full h-36 bg-muted/50 relative overflow-hidden border-b border-border/50">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={`/api/feeds/image-proxy?url=${encodeURIComponent(article.thumbnail_url)}`}
                                  alt="" 
                                  loading="lazy"
                                  className="w-full h-full object-cover"  
                                  onError={(e) => {
                                    const el = e.target as HTMLImageElement
                                    el.style.display = 'none'
                                    const parent = el.parentElement
                                    if (parent) parent.style.display = 'none'
                                  }}
                                />
                              </div>
                            )}
                            <div className="p-4 space-y-3">
                              <h5 className={`font-bold leading-snug text-foreground ${article.thumbnail_url && article.thumbnail_url.startsWith('http') ? 'text-sm line-clamp-3' : 'text-[15px] line-clamp-4'}`}>
                                {article.title}
                              </h5>
                              <p className="text-xs text-muted-foreground line-clamp-4 leading-relaxed">
                                {renderDescription(article.description)}
                              </p>
                              <div className="flex items-center gap-2 pt-3 mt-1 border-t border-border/50 text-[10px] text-primary/80 font-medium uppercase tracking-wider">
                                {article.author && (
                                  <>
                                    <User className="h-3 w-3 shrink-0" />
                                    <span className="truncate max-w-[120px]">{article.author}</span>
                                    <span>•</span>
                                  </>
                                )}
                                <span className="opacity-90">
                                  {new Date(article.pub_date || article.created_at).toLocaleDateString(undefined, {
                                    month: 'long', day: 'numeric', year: 'numeric'
                                  })}
                                </span>
                              </div>
                            </div>
                          </HoverCardContent>
                        </HoverCard>
                      </li>
                    )})}
                  </ul>
                  {group.totalPages > 1 && (
                    <div className="border-t border-border/30 px-3 py-1.5 flex items-center justify-center gap-2">
                      <button
                        type="button"
                        disabled={group.page <= 1 || group.loading}
                        onClick={() => handleGroupPage(group.sourceName, group.articles[0]?.source_id, group.page - 1)}
                        className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      {group.loading ? (
                        <Loader2 className="h-3 w-3 animate-spin text-primary" />
                      ) : (
                        <span className="text-[10px] font-medium text-muted-foreground tabular-nums min-w-[32px] text-center">
                          {group.page} / {group.totalPages}
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={group.page >= group.totalPages || group.loading}
                        onClick={() => handleGroupPage(group.sourceName, group.articles[0]?.source_id, group.page + 1)}
                        className="p-0.5 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {articles.map(article => (
              <Card 
                key={article.id} 
                className="group relative glass-card hover:border-primary/50 hover:shadow-[0_0_30px_-5px_var(--tw-shadow-color)] shadow-primary/20 transition-all duration-300 overflow-hidden flex flex-col"
              >
                {/* Subtle gradient overlay effect on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                
                <CardContent className="p-6 flex flex-col h-full relative z-10">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] uppercase tracking-wider font-semibold text-primary/80 bg-primary/10 px-2 py-1 rounded-sm">
                      {article.source_name}
                    </span>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground shrink-0">
                      <Calendar className="h-3 w-3" />
                      {new Date(article.pub_date || article.created_at).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric'
                      })}
                    </div>
                  </div>

                  <h3 className="text-lg font-bold leading-tight mb-3 text-foreground group-hover:text-primary transition-colors line-clamp-3">
                    <a href={article.link} target="_blank" rel="noopener noreferrer" className="focus:outline-none">
                      {article.title}
                    </a>
                  </h3>

                  <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-4 mb-6">
                    {renderDescription(article.description)}
                  </p>

                  <div className="mt-auto border-t border-border/50 pt-4 flex flex-wrap items-center justify-between gap-3">
                    {article.author ? (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground flex-1 min-w-0" title={article.author}>
                        <User className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{article.author}</span>
                      </div>
                    ) : (
                      <div className="flex-1" />
                    )}
                    <a 
                      href={article.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-foreground hover:text-primary flex items-center gap-2 transition-colors shrink-0"
                    >
                      Read more detail <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination Details */}
        {!loading && totalPages > 1 && viewMode === 'timeline' && (
          <div className="flex items-center justify-center gap-4 pt-8">
            <Button 
              variant="outline" 
              className="glass-card hover:bg-primary/20"
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground font-medium bg-background/50 px-4 py-2 rounded-md border border-border">
              Page <span className="text-foreground">{page}</span> of {totalPages}
            </span>
            <Button 
              variant="outline" 
              className="glass-card hover:bg-primary/20"
              disabled={page >= totalPages} 
              onClick={() => setPage(p => p + 1)}
            >
              Next
            </Button>
          </div>
        )}

      </div>
    </main>
  )
}
