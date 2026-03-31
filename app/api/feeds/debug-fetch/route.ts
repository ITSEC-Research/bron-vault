export const dynamic = 'force-dynamic'
import { NextResponse } from "next/server"
import { executeQuery } from "@/lib/mysql"

export async function GET() {
  try {
    const rawJoin = await executeQuery(`
      SELECT a.*, s.name as source_name, c.name as category_name 
      FROM feed_articles a
      JOIN feed_sources s ON a.source_id = s.id
      JOIN feed_categories c ON s.category_id = c.id
      LIMIT 5
    `)
    
    // Explicitly test JSON serialization
    const testJson = JSON.stringify(rawJoin)

    return NextResponse.json({
      success: true,
      data: JSON.parse(testJson), // If it serialized properly, this works
      count: (rawJoin as any[]).length
    })
  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error_message: error.message, 
      error_name: error.name,
      stack: error.stack
    }, { status: 500 })
  }
}
