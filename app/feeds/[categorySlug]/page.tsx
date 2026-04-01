"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { ExternalLink, Calendar, Search, Newspaper, Activity, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { DashboardDateRange } from "@/components/dashboard-date-range"
import { DateRangeType, dateRangeToQueryParams } from "@/lib/date-range-utils"

interface Article {
  id: number
  guid: string
  title: string
  link: string
  description: string
  pub_date: string
  created_at: string
  source_name: string
  category_name: string
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

  useEffect(() => {
    fetchArticles()
    // Trigger polling every 5 minutes while page is open (optional, keeps it fresh)
    const interval = setInterval(fetchArticles, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [categorySlug, page])

  const fetchArticles = async (overrideSearch?: string) => {
    try {
      setLoading(true)
      const searchQuery = overrideSearch !== undefined ? overrideSearch : search
      let url = `/api/feeds/articles?category_slug=${categorySlug}&page=${page}&limit=20&q=${encodeURIComponent(searchQuery)}`
      
      const dateParams = dateRangeToQueryParams(dateRange)
      if (dateParams.startDate) url += `&startDate=${dateParams.startDate}`
      if (dateParams.endDate) url += `&endDate=${dateParams.endDate}`

      const res = await fetch(url)
      if (res.ok) {
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
              Real-time updates from your preferred security and intelligence sources.
            </p>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-3 w-full md:w-auto mt-4 md:mt-0 items-start md:items-center justify-end">
            <DashboardDateRange
              value={dateRange}
              onChange={setDateRange}
              className="w-full md:w-[260px] glass-card bg-background/50 border-white/10 shrink-0"
              align="center"
            />
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10 pointer-events-none" />
                <Input 
                  placeholder="Search topics..." 
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 glass-card border-border/50 text-foreground placeholder:text-muted-foreground"
                />
              </div>
              <Button type="submit" size="sm" className="h-9 glass-card hover:bg-primary/20 bg-primary/10 text-primary border-primary/20 w-full sm:w-auto shrink-0">
                Filter
              </Button>
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
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
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

                  <div className="mt-auto border-t border-border/50 pt-4 flex items-center justify-end">
                    <a 
                      href={article.link} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-foreground hover:text-primary flex items-center gap-2 transition-colors"
                    >
                      Read Full Report <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Pagination Details */}
        {!loading && totalPages > 1 && (
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
