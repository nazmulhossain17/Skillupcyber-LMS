// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db/drizzle'
import { user, app_users } from '@/db/schema'
import { auth } from '@/lib/auth'
import { eq, ilike, desc, or, sql } from 'drizzle-orm'

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({
    headers: request.headers,
  })

  // Must be logged in
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Must be admin
  const appUser = await db
    .select({ role: app_users.role })
    .from(app_users)
    .where(eq(app_users.userId, session.user.id))
    .then((rows) => rows[0])

  if (!appUser || appUser.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: Admin only' }, { status: 403 })
  }

  // Fix: Properly extract and type search params
  const { searchParams } = new URL(request.url)

  const search = searchParams.get('search')?.trim() ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '50'), 100)
  const offset = Math.max(Number(searchParams.get('offset') ?? '0'), 0)

  // Build query with proper typing
  let query = db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      image: user.image,
      createdAt: user.createdAt,

      // app_users fields
      role: app_users.role,
      isActive: app_users.isActive,
      lastLoginAt: app_users.lastLoginAt,
      phone: app_users.phone,
      country: app_users.country,
      bio: app_users.bio,
      avatar: app_users.avatar,
      timezone: app_users.timezone,
    })
    .from(user)
    .leftJoin(app_users, eq(user.id, app_users.userId))
    .limit(limit)
    .offset(offset)
    .$dynamic()

  // Search filter
  if (search) {
    query = query.where(
      or(
        ilike(user.name, `%${search}%`),
        ilike(user.email, `%${search}%`)
      )
    )
  }

  query = query.orderBy(desc(user.createdAt))

  const users = await query

  // Total count for pagination
  const totalResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(user)
    .leftJoin(app_users, eq(user.id, app_users.userId))
    .then((rows) => rows[0]?.count ?? 0)

  return NextResponse.json(
    {
      users,
      pagination: {
        total: totalResult,
        limit,
        offset,
        hasMore: offset + users.length < totalResult,
      },
    },
    {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=30',
      },
    }
  )
}