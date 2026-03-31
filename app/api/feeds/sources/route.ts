import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { executeQuery } from "@/lib/mysql"

export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const category_id = searchParams.get('category_id')

    let query = `
      SELECT s.*, c.name as category_name 
      FROM feed_sources s
      LEFT JOIN feed_categories c ON s.category_id = c.id
    `
    const params: any[] = []

    if (category_id) {
      query += ` WHERE s.category_id = ?`
      params.push(category_id)
    }

    query += ` ORDER BY s.name ASC`

    const sources = await executeQuery(query, params)
    return NextResponse.json({ success: true, sources })
  } catch (error) {
    console.error("[NewsFeed] Error getting sources:", error)
    return NextResponse.json({ success: false, error: "Failed to get sources" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const roleError = requireAdminRole(user)
  if (roleError) return roleError

  try {
    const body = await request.json()
    const { category_id, name, rss_url, website_url, is_active = true } = body

    if (!category_id || !name || !rss_url) {
      return NextResponse.json({ success: false, error: "Category ID, name, and RSS URL are required" }, { status: 400 })
    }

    const result = await executeQuery(
      `INSERT INTO feed_sources (category_id, name, rss_url, website_url, is_active) VALUES (?, ?, ?, ?, ?)`,
      [category_id, name, rss_url, website_url || null, is_active ? 1 : 0]
    )

    return NextResponse.json({ 
      success: true, 
      message: "Source created", 
      id: (result as any).insertId 
    })
  } catch (error) {
    console.error("[NewsFeed] Error creating source:", error)
    return NextResponse.json({ success: false, error: "Failed to create source" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const roleError = requireAdminRole(user)
  if (roleError) return roleError

  try {
    const body = await request.json()
    const { id, category_id, name, rss_url, website_url, is_active } = body

    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 })
    }

    const updates: string[] = []
    const values: any[] = []

    if (category_id !== undefined) { updates.push('category_id = ?'); values.push(category_id) }
    if (name !== undefined) { updates.push('name = ?'); values.push(name) }
    if (rss_url !== undefined) { updates.push('rss_url = ?'); values.push(rss_url) }
    if (website_url !== undefined) { updates.push('website_url = ?'); values.push(website_url || null) }
    if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active ? 1 : 0) }

    if (updates.length > 0) {
      values.push(id)
      await executeQuery(
        `UPDATE feed_sources SET ${updates.join(', ')} WHERE id = ?`,
        values
      )
    }

    return NextResponse.json({ success: true, message: "Source updated" })
  } catch (error) {
    console.error("[NewsFeed] Error updating source:", error)
    return NextResponse.json({ success: false, error: "Failed to update source" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  const roleError = requireAdminRole(user)
  if (roleError) return roleError

  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ success: false, error: "ID is required" }, { status: 400 })
    }

    await executeQuery(`DELETE FROM feed_sources WHERE id = ?`, [id])

    return NextResponse.json({ success: true, message: "Source deleted" })
  } catch (error) {
    console.error("[NewsFeed] Error deleting source:", error)
    return NextResponse.json({ success: false, error: "Failed to delete source" }, { status: 500 })
  }
}
