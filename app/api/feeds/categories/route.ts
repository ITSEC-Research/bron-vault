import { NextRequest, NextResponse } from "next/server"
import { validateRequest, requireAdminRole } from "@/lib/auth"
import { executeQuery } from "@/lib/mysql"

export async function GET(request: NextRequest) {
  const user = await validateRequest(request)
  if (!user) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
  }

  try {
    const categories = await executeQuery(`SELECT * FROM feed_categories ORDER BY display_order ASC, name ASC`)
    return NextResponse.json({ success: true, categories })
  } catch (error) {
    console.error("[NewsFeed] Error getting categories:", error)
    return NextResponse.json({ success: false, error: "Failed to get categories" }, { status: 500 })
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
    const { name, slug, display_order = 0 } = body

    if (!name || !slug) {
      return NextResponse.json({ success: false, error: "Name and slug are required" }, { status: 400 })
    }

    const result = await executeQuery(
      `INSERT INTO feed_categories (name, slug, display_order) VALUES (?, ?, ?)`,
      [name, slug, display_order]
    )

    return NextResponse.json({ 
      success: true, 
      message: "Category created", 
      id: (result as any).insertId 
    })
  } catch (error: any) {
    console.error("[NewsFeed] Error creating category:", error)
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ success: false, error: "A category with this slug already exists" }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Failed to create category" }, { status: 500 })
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
    const { id, name, slug, display_order } = body

    if (!id || (!name && !slug && display_order === undefined)) {
      return NextResponse.json({ success: false, error: "ID and at least one field to update are required" }, { status: 400 })
    }

    // Build dynamic update
    const updates: string[] = []
    const values: any[] = []

    if (name) { updates.push('name = ?'); values.push(name) }
    if (slug) { updates.push('slug = ?'); values.push(slug) }
    if (display_order !== undefined) { updates.push('display_order = ?'); values.push(display_order) }

    values.push(id)

    await executeQuery(
      `UPDATE feed_categories SET ${updates.join(', ')} WHERE id = ?`,
      values
    )

    return NextResponse.json({ success: true, message: "Category updated" })
  } catch (error: any) {
    console.error("[NewsFeed] Error updating category:", error)
    if (error.code === 'ER_DUP_ENTRY') {
      return NextResponse.json({ success: false, error: "A category with this slug already exists" }, { status: 400 })
    }
    return NextResponse.json({ success: false, error: "Failed to update category" }, { status: 500 })
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

    await executeQuery(`DELETE FROM feed_categories WHERE id = ?`, [id])

    return NextResponse.json({ success: true, message: "Category deleted" })
  } catch (error) {
    console.error("[NewsFeed] Error deleting category:", error)
    return NextResponse.json({ success: false, error: "Failed to delete category" }, { status: 500 })
  }
}
