export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { executeQuery } from "@/lib/mysql"
import { triggerBackgroundSyncIfNeeded } from "@/lib/feed-sync"

export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    // 1. SWR: Perform a non-blocking check to see if feeds need a background sync
    // This function will spawn a background promise and return immediately
    triggerBackgroundSyncIfNeeded()

    const { searchParams } = new URL(request.url)
    const category_slug = searchParams.get('category_slug')
    const source_id = searchParams.get('source_id')
    const search = searchParams.get('q')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const offset = (page - 1) * limit

    let query = `
      SELECT a.*, s.name as source_name, c.name as category_name
      FROM feed_articles a
      JOIN feed_sources s ON a.source_id = s.id
      JOIN feed_categories c ON s.category_id = c.id
      WHERE 1=1
    `
    const params: any[] = []

    if (category_slug && category_slug !== 'all') {
      query += ` AND c.slug = ?`
      params.push(category_slug)
    }

    if (source_id) {
      query += ` AND s.id = ?`
      params.push(source_id)
    }

    if (search) {
      query += ` AND (a.title LIKE ? OR a.description LIKE ?)`
      params.push(`%${search}%`, `%${search}%`)
    }

    if (startDate) {
      query += ` AND DATE(COALESCE(a.pub_date, a.created_at)) >= ?`
      params.push(startDate)
    }

    if (endDate) {
      query += ` AND DATE(COALESCE(a.pub_date, a.created_at)) <= ?`
      params.push(endDate)
    }

    // Get total count
    const countQuery = query.replace('SELECT a.*, s.name as source_name, c.name as category_name', 'SELECT COUNT(*) as total')
    const [countResult]: any = await executeQuery(countQuery, params)
    const total = countResult?.total || 0

    // Get paginated data
    query += ` ORDER BY COALESCE(a.pub_date, a.created_at) DESC LIMIT ${Number(limit)} OFFSET ${Number(offset)}`
    
    const articles = await executeQuery(query, params)

    return NextResponse.json({ 
      success: true, 
      articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error("[NewsFeed] Error getting articles:", error)
    return NextResponse.json({ success: false, error: "Failed to fetch articles" }, { status: 500 })
  }
}
