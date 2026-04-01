import Parser from "rss-parser"
import { executeQuery, pool } from "@/lib/mysql"
import { settingsManager, SETTING_KEYS } from "@/lib/settings"

// Initialize rss-parser
const parser = new Parser({
  timeout: 30000,
  customFields: {
    item: [
      'content:encoded', 'description', 'pubDate', 'guid', 'creator', 'author', 'dc:creator',
      'media:thumbnail', 'media:content', 'enclosure',
    ],
  }
})

export interface FeedCategory {
  id: number
  name: string
  slug: string
  display_order: number
}

export interface FeedSource {
  id: number
  category_id: number
  name: string
  website_url: string | null
  rss_url: string
  is_active: boolean
  last_fetched_at: Date | null
}

export interface SyncStats {
  sourcesProcessed: number
  sourcesFailed: number
  articlesAdded: number
  errors: string[]
}

// Clean HTML to prevent XSS and improve display
function cleanHtml(text: string | null | undefined): string {
  if (!text) return ""
  return text
    .replace(/<[^>]*>/g, " ") // Remove HTML tags
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ") // Collapse whitespace
    .trim()
}

// Extract thumbnail image URL from RSS item content before HTML is stripped
function extractThumbnail(item: any): string | null {
  // 1. Check media:content (Ars Technica style: media:content.$.url with medium=image)
  //    rss-parser nests media:thumbnail inside media:content
  if (item['media:content']?.$?.url) {
    const mc = item['media:content'].$
    if (mc.medium === 'image' || /\.(jpg|jpeg|png|gif|webp)/i.test(mc.url)) {
      return mc.url
    }
  }
  
  // 2. Check media:thumbnail at top level (some feeds put it here directly)
  if (typeof item['media:thumbnail'] === 'string') return item['media:thumbnail']
  if (item['media:thumbnail']?.$?.url) return item['media:thumbnail'].$.url
  if (item['media:thumbnail']?.url) return item['media:thumbnail'].url
  
  // 3. Check media:thumbnail nested inside media:content (Ars Technica)
  const nestedThumb = item['media:content']?.['media:thumbnail']
  if (Array.isArray(nestedThumb) && nestedThumb[0]?.$?.url) {
    return nestedThumb[0].$.url
  }
  
  // 4. Check enclosure (podcast/media feeds often use this for images)
  if (item.enclosure?.url && item.enclosure?.type?.startsWith('image/')) {
    return item.enclosure.url
  }
  
  // 5. Extract first <img> from content:encoded or content or description (raw HTML before cleaning)
  const rawHtml = item['content:encoded'] || item.content || item.description || ''
  const imgMatch = rawHtml.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch && imgMatch[1]) return imgMatch[1]
  
  return null
}

/**
 * Perform a background sync based on SWR (Stale-While-Revalidate) logic.
 * This checks if any active feeds need updating according to the configured interval.
 */
export async function triggerBackgroundSyncIfNeeded(): Promise<void> {
  try {
    const intervalMinutes = await settingsManager.getSettingNumber(SETTING_KEYS.FEED_SYNC_INTERVAL, 60)
    
    // Find active sources that are due for a sync
    const staleQuery = `
      SELECT id, name, rss_url 
      FROM feed_sources 
      WHERE is_active = 1 
      AND (last_fetched_at IS NULL OR last_fetched_at < DATE_SUB(NOW(), INTERVAL ? MINUTE))
    `
    const staleSources = await executeQuery(staleQuery, [intervalMinutes]) as any[]

    if (staleSources.length > 0) {
      console.log(`[NewsFeed] SWR Trigger: Found ${staleSources.length} stale sources. Starting background sync...`)
      // Non-blocking background sync. We don't await this so the caller returns immediately.
      // Next.js might kill background tasks on Edge/Serverless depending on the environment, 
      // but "after()" or just floating promises often work in standard Node setups like Docker.
      syncStaleSources(staleSources).catch(err => {
        console.error("[NewsFeed] Background sync failed:", err)
      })
    }
  } catch (error) {
    console.error("[NewsFeed] Error in triggerBackgroundSyncIfNeeded:", error)
  }
}

/**
 * Manually force a sync of all active feeds. (For 'Fetch Now' button)
 */
export async function forceSyncAllFeeds(): Promise<SyncStats> {
  try {
    const sources = await executeQuery(`SELECT * FROM feed_sources WHERE is_active = 1`) as any[]
    return await syncStaleSources(sources)
  } catch (error) {
    console.error("[NewsFeed] Force sync failed:", error)
    return { sourcesProcessed: 0, sourcesFailed: 0, articlesAdded: 0, errors: [String(error)] }
  }
}

/**
 * Core function to fetch and save articles for given sources
 */
async function syncStaleSources(sources: any[]): Promise<SyncStats> {
  const stats: SyncStats = {
    sourcesProcessed: 0,
    sourcesFailed: 0,
    articlesAdded: 0,
    errors: []
  }

  for (const source of sources) {
    try {
      console.log(`[NewsFeed] Fetching RSS for: ${source.name} (${source.rss_url})`)
      const feed = await parser.parseURL(source.rss_url)
      
      let newArticlesCount = 0
      
      // Process items (limit to 30 latest to avoid bloated DBs on first run)
      const maxItems = 30
      const itemsToProcess = feed.items.slice(0, maxItems)

      for (const item of itemsToProcess) {
        // Guid fallback
        const guid = item.guid || (item as any).id || item.link || String(Date.now() + Math.random())
        const title = item.title || "Untitled"
        const link = item.link || source.website_url || source.rss_url
        const description = cleanHtml(item.contentSnippet || item.content || item.description || "")
        const author = item.creator || item.author || item['dc:creator'] || null
        const thumbnailUrl = extractThumbnail(item)
        
        // PubDate parsing
        let pubDate = null
        if (item.pubDate || item.isoDate) {
           const d = new Date(item.isoDate || item.pubDate!)
           if (!isNaN(d.getTime())) {
              pubDate = d
           }
        }

        // Insert using IGNORE to skip duplicates based on UNIQUE INDEX (guid, source_id)
        const insertQuery = `
          INSERT IGNORE INTO feed_articles 
            (source_id, guid, title, link, description, author, thumbnail_url, pub_date) 
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        const [result] = await pool.query(insertQuery, [
          source.id, 
          guid.substring(0, 500), 
          title.substring(0, 500), 
          link.substring(0, 1000), 
          description.substring(0, 2000), 
          author ? String(author).substring(0, 255) : null,
          thumbnailUrl ? thumbnailUrl.substring(0, 2000) : null,
          pubDate
        ])

        if ((result as any).affectedRows > 0) {
          newArticlesCount++
        }
      }

      // Update last_fetched_at flag
      await executeQuery(`UPDATE feed_sources SET last_fetched_at = NOW() WHERE id = ?`, [source.id])
      
      stats.sourcesProcessed++
      stats.articlesAdded += newArticlesCount
      console.log(`[NewsFeed] Synced ${source.name}: +${newArticlesCount} new articles.`)

    } catch (error) {
      console.error(`[NewsFeed] Failed to parse URL ${source.rss_url}:`, error)
      stats.sourcesFailed++
      stats.errors.push(`Failed to sync ${source.name}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  return stats
}

/**
 * Fetch all categories with their active sources. Used to construct the sidebar.
 */
export async function getFeedCategoriesWithSources() {
  const categories = await executeQuery(`
    SELECT * FROM feed_categories ORDER BY display_order ASC, name ASC
  `) as any[]

  const sources = await executeQuery(`
    SELECT * FROM feed_sources WHERE is_active = 1 ORDER BY name ASC
  `) as any[]

  // Group sources by category
  return categories.map(cat => ({
    ...cat,
    sources: sources.filter(s => s.category_id === cat.id)
  })).filter(cat => cat.sources.length > 0) // Only return categories that have active sources
}
