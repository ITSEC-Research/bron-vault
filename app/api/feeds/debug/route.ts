export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"

export async function GET() {
  try {
    const cats = await executeQuery("SELECT * FROM feed_categories")
    const sources = await executeQuery("SELECT * FROM feed_sources")
    const articlesQuery = "SELECT COUNT(*) as c FROM feed_articles"
    const [articles]: any = await executeQuery(articlesQuery)
    const joinRaw = await executeQuery(`
      SELECT a.id, a.title, c.slug 
      FROM feed_articles a
      JOIN feed_sources s ON a.source_id = s.id
      JOIN feed_categories c ON s.category_id = c.id
      LIMIT 5
    `)
    return NextResponse.json({
      cats,
      sources,
      article_count: articles?.c || 0,
      joinRaw,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
