import { db } from "@/db/drizzle"
import { categories } from "@/db/schema"
import { auth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Optional: check admin role again
  // ... your admin check ...

  const updates = await request.json()

  try {
    for (const { id, order } of updates) {
      await db.update(categories).set({ order }).where(eq(categories.id, id))
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    return NextResponse.json({ error: 'Failed to reorder' }, { status: 500 })
  }
}