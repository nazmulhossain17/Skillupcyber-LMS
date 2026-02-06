import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/drizzle'
import { categories, app_users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { eq, ilike } from 'drizzle-orm'
import { z } from 'zod'

const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
  order: z.number().int().min(0).optional(),
})

const updateCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(2).max(100).optional(),
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100).optional(),
  order: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
})

// ====================
// 1. GET /api/categories (Public)
// ====================
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get('search')?.trim()
  const limit = Math.min(Number(searchParams.get('limit') ?? 50), 100)

  let query = db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      courseCount: categories.courseCount,
      order: categories.order,
      isActive: categories.isActive,
    })
    .from(categories)
    .where(eq(categories.isActive, true))
    .limit(limit)
    .$dynamic()

  if (search) {
    query = query.where(ilike(categories.name, `%${search}%`))
  }

  query = query.orderBy(categories.order, categories.name)

  const result = await query

  return NextResponse.json(
    { categories: result, count: result.length },
  )
}

// ====================
// 2. POST /api/categories (Admin only)
// ====================
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appUser = await db
    .select({ role: app_users.role })
    .from(app_users)
    .where(eq(app_users.userId, session.user.id))
    .then((rows) => rows[0])

  if (!appUser || appUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = createCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.format() }, { status: 400 })
  }

  const { name, slug, order = 0 } = parsed.data

  const exists = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, slug))
    .then((rows) => rows[0])

  if (exists) {
    return NextResponse.json({ error: 'Slug already exists' }, { status: 409 })
  }

  const [newCat] = await db
    .insert(categories)
    .values({ name, slug, order })
    .returning()

  return NextResponse.json({ category: newCat }, { status: 201 })
}

// ====================
// 3. PATCH /api/categories (Admin only)
// ====================
export async function PATCH(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appUser = await db
    .select({ role: app_users.role })
    .from(app_users)
    .where(eq(app_users.userId, session.user.id))
    .then((rows) => rows[0])

  if (!appUser || appUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const parsed = updateCategorySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const { id, ...updates } = parsed.data

  if (updates.slug) {
  const existing = await db
    .select({ id: categories.id })
    .from(categories)
    .where(eq(categories.slug, updates.slug))
    .limit(1)

  // Allow same slug if it's the same category
  if (existing.length > 0 && existing[0].id !== id) {
    return NextResponse.json(
      { error: 'Slug already used by another category' },
      { status: 409 }
    )
  }
}

  const [updated] = await db
    .update(categories)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning()

  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ category: updated })
}

// ====================
// 4. DELETE /api/categories (Soft delete)
// ====================
export async function DELETE(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const appUser = await db
    .select({ role: app_users.role })
    .from(app_users)
    .where(eq(app_users.userId, session.user.id))
    .then((rows) => rows[0])

  if (!appUser || appUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await request.json()

  const [deleted] = await db
    .update(categories)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning()

  if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ message: 'Category deactivated' })
}