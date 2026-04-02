export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from "next/server"
import { validateRequest } from "@/lib/auth"
import { executeQuery } from "@/lib/mysql"
import { triggerBackgroundSyncIfNeeded } from "@/lib/feed-sync"

function buildSearchCondition(searchStr: string) {
  if (!searchStr) return { condition: null, params: [] };

  const tokens: string[] = [];
  let inQuote = false;
  let currentToken = '';

  for (let i = 0; i < searchStr.length; i++) {
    const char = searchStr[i];
    if (char === '"') {
      inQuote = !inQuote;
      currentToken += char; 
    } else if (char === ' ' && !inQuote) {
      if (currentToken) {
        tokens.push(currentToken);
        currentToken = '';
      }
    } else {
      currentToken += char;
    }
  }
  if (currentToken) tokens.push(currentToken);

  const orGroups: string[][] = [];
  let currentAndGroup: string[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token === 'OR') {
      if (currentAndGroup.length > 0) {
        orGroups.push(currentAndGroup);
        currentAndGroup = [];
      }
    } else if (token === 'AND') {
      // ignore, implicit AND
    } else {
      let cleanTerm = token;
      if (cleanTerm.startsWith('"') && cleanTerm.endsWith('"') && cleanTerm.length >= 2) {
        cleanTerm = cleanTerm.substring(1, cleanTerm.length - 1);
      }
      if (cleanTerm) currentAndGroup.push(cleanTerm);
    }
  }
  if (currentAndGroup.length > 0) {
    orGroups.push(currentAndGroup);
  }

  const sqlChunks: string[] = [];
  const sqlParams: any[] = [];

  for (const andGroup of orGroups) {
    if (andGroup.length === 0) continue;
    const andChunks: string[] = [];
    for (const term of andGroup) {
      andChunks.push(`(a.title LIKE ? OR a.description LIKE ?)`);
      sqlParams.push(`%${term}%`, `%${term}%`);
    }
    sqlChunks.push(`(${andChunks.join(' AND ')})`);
  }

  if (sqlChunks.length === 0) return { condition: null, params: [] };

  return { condition: `(${sqlChunks.join(' OR ')})`, params: sqlParams };
}

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
    const view = searchParams.get('view') // 'timeline' or 'grouped'

    // Handle Grouped View
    if (view === 'grouped') {

      // Per-group page fetch: when source_id is specified, return a single source's paginated articles
      if (source_id) {
        const group_page = parseInt(searchParams.get('group_page') || '1')
        const group_limit = 7
        const group_offset = (group_page - 1) * group_limit

        let srcQuery = `
          SELECT a.*, s.name as source_name, c.name as category_name
          FROM feed_articles a
          JOIN feed_sources s ON a.source_id = s.id
          JOIN feed_categories c ON s.category_id = c.id
          WHERE a.source_id = ?
        `
        const srcParams: any[] = [source_id]

        if (category_slug && category_slug !== 'all') {
          srcQuery += ` AND c.slug = ?`
          srcParams.push(category_slug)
        }
        if (search) {
          const { condition, params: searchParamsArr } = buildSearchCondition(search);
          if (condition) {
            srcQuery += ` AND ${condition}`;
            srcParams.push(...searchParamsArr);
          }
        }
        if (startDate) {
          srcQuery += ` AND DATE(COALESCE(a.pub_date, a.created_at)) >= ?`
          srcParams.push(startDate)
        }
        if (endDate) {
          srcQuery += ` AND DATE(COALESCE(a.pub_date, a.created_at)) <= ?`
          srcParams.push(endDate)
        }

        const countQuery = srcQuery.replace(
          'SELECT a.*, s.name as source_name, c.name as category_name',
          'SELECT COUNT(*) as total'
        )
        const [countResult]: any = await executeQuery(countQuery, srcParams)
        const total = countResult?.total || 0

        srcQuery += ` ORDER BY COALESCE(a.pub_date, a.created_at) DESC LIMIT ${Number(group_limit)} OFFSET ${Number(group_offset)}`
        const articles = await executeQuery(srcQuery, srcParams)

        return NextResponse.json({
          success: true,
          articles,
          pagination: {
            page: group_page,
            limit: group_limit,
            total,
            totalPages: Math.ceil(total / group_limit)
          }
        })
      }

      // Initial bulk load: all sources, first 7 articles each, with per-source total count
      let groupedQuery = `
        SELECT * FROM (
          SELECT a.*, s.name as source_name, c.name as category_name,
                 ROW_NUMBER() OVER (PARTITION BY a.source_id ORDER BY COALESCE(a.pub_date, a.created_at) DESC) as rn,
                 COUNT(*) OVER (PARTITION BY a.source_id) as source_total
          FROM feed_articles a
          JOIN feed_sources s ON a.source_id = s.id
          JOIN feed_categories c ON s.category_id = c.id
          WHERE 1=1
      `
      const groupedParams: any[] = []

      if (category_slug && category_slug !== 'all') {
        groupedQuery += ` AND c.slug = ?`
        groupedParams.push(category_slug)
      }
      if (search) {
        const { condition, params: searchParamsArr } = buildSearchCondition(search);
        if (condition) {
          groupedQuery += ` AND ${condition}`;
          groupedParams.push(...searchParamsArr);
        }
      }
      if (startDate) {
        groupedQuery += ` AND DATE(COALESCE(a.pub_date, a.created_at)) >= ?`
        groupedParams.push(startDate)
      }
      if (endDate) {
        groupedQuery += ` AND DATE(COALESCE(a.pub_date, a.created_at)) <= ?`
        groupedParams.push(endDate)
      }

      groupedQuery += `
        ) t WHERE t.rn <= 7
        ORDER BY t.source_name ASC, t.rn ASC
        LIMIT 500
      `
      
      const articles = await executeQuery(groupedQuery, groupedParams)
      
      return NextResponse.json({ 
        success: true, 
        articles,
        pagination: {
          page: 1,
          limit: 500,
          total: (articles as any[]).length,
          totalPages: 1
        }
      })
    }

    // Default Timeline View
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
      const { condition, params: searchParamsArr } = buildSearchCondition(search);
      if (condition) {
        query += ` AND ${condition}`;
        params.push(...searchParamsArr);
      }
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
