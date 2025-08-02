export const dynamic = "force-dynamic";
import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"

interface RSSItem {
  title: string
  link: string
  description: string
  pubDate: string
  guid?: string
}

interface RSSFeed {
  title: string
  description: string
  items: RSSItem[]
  lastUpdated: string
}

export async function GET(request: NextRequest) {
  // Validate authentication
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const source = searchParams.get("source")

    console.log(`📡 RSS Feed request for source: ${source}`)

    let feedUrl = ""
    let feedName = ""

    switch (source) {
      case "malware-traffic":
        feedUrl = "https://www.malware-traffic-analysis.net/blog-entries.rss"
        feedName = "Malware Traffic Analysis"
        break
      case "ransomware-live":
        feedUrl = "https://www.ransomware.live/rss.xml"
        feedName = "Ransomware Live"
        break
      default:
        return NextResponse.json({ error: "Invalid RSS source" }, { status: 400 })
    }

    console.log(`📡 Fetching RSS from: ${feedUrl}`)

    const response = await fetch(feedUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; StealerLogsDashboard/1.0)",
        Accept: "application/rss+xml, application/xml, text/xml",
        "Cache-Control": "no-cache",
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout
    })

    if (!response.ok) {
      throw new Error(`RSS fetch failed: ${response.status} ${response.statusText}`)
    }

    const xmlText = await response.text()
    console.log(`📄 RSS XML length: ${xmlText.length}`)

    // Parse RSS XML
    const rssData = parseRSSXML(xmlText, feedName)

    console.log(`✅ Parsed ${rssData.items.length} RSS items from ${feedName}`)

    return NextResponse.json({
      success: true,
      feed: rssData,
      source: source,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("❌ RSS Feed error:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch RSS feed",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 },
    )
  }
}

function parseRSSXML(xmlText: string, feedName: string): RSSFeed {
  try {
    // Simple XML parsing for RSS
    const items: RSSItem[] = []

    // Extract channel title and description
    const channelTitleMatch = xmlText.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i)
    const channelDescMatch = xmlText.match(
      /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/i,
    )

    const channelTitle = channelTitleMatch ? channelTitleMatch[1] || channelTitleMatch[2] || feedName : feedName
    const channelDesc = channelDescMatch ? channelDescMatch[1] || channelDescMatch[2] || "" : ""

    // Extract items
    // Use a RegExp compatible with ES2017 (no 's' flag)
    const itemMatches = []
    const itemRegex = /<item>([\s\S]*?)<\/item>/g
    let match
    while ((match = itemRegex.exec(xmlText)) !== null) {
      itemMatches.push(match[0])
    }

    if (itemMatches.length > 0) {
      for (const itemXml of itemMatches.slice(0, 10)) {
        // Limit to 10 items
        const titleMatch = itemXml.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/i)
        const linkMatch = itemXml.match(/<link><!\[CDATA\[(.*?)\]\]><\/link>|<link>(.*?)<\/link>/i)
        const descMatch = itemXml.match(
          /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/i,
        )
        const pubDateMatch = itemXml.match(/<pubDate>(.*?)<\/pubDate>/i)
        const guidMatch = itemXml.match(/<guid.*?>(.*?)<\/guid>/i)

        const title = titleMatch ? titleMatch[1] || titleMatch[2] || "No Title" : "No Title"
        const link = linkMatch ? linkMatch[1] || linkMatch[2] || "#" : "#"
        const description = descMatch ? descMatch[1] || descMatch[2] || "" : ""
        const pubDate = pubDateMatch ? pubDateMatch[1] : ""
        const guid = guidMatch ? guidMatch[1] : ""

        items.push({
          title: cleanHtml(title),
          link: link.trim(),
          description: cleanHtml(description).substring(0, 200) + (description.length > 200 ? "..." : ""),
          pubDate: formatDate(pubDate),
          guid: guid,
        })
      }
    }

    return {
      title: cleanHtml(channelTitle),
      description: cleanHtml(channelDesc),
      items,
      lastUpdated: new Date().toISOString(),
    }
  } catch (error) {
    console.error("❌ RSS XML parsing error:", error)
    return {
      title: feedName,
      description: "Failed to parse RSS feed",
      items: [],
      lastUpdated: new Date().toISOString(),
    }
  }
}

function cleanHtml(text: string): string {
  return text
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim()
}

function formatDate(dateString: string): string {
  try {
    if (!dateString) return ""
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  } catch {
    return dateString
  }
}
