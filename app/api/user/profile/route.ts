import { db } from "@/db/drizzle"
import { app_users } from "@/db/schema"
import { auth } from "@/lib/auth"
import { eq } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

// GET - Fetch current profile
export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [profile] = await db
    .select()
    .from(app_users)
    .where(eq(app_users.userId, session.user.id))
    .limit(1)

  return NextResponse.json({ 
    profile: profile || {
      name: session.user.name || "User",
      email: session.user.email,
      avatar: session.user.image,
      role: "student",
      bio: null,
      phone: null,
      country: null,
      timezone: null,
    }
  })
}

// PATCH - Update avatar, bio, phone
export async function PATCH(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers })
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json()
  const { bio, phone, avatar } = body

  const updateData: any = {
    updatedAt: new Date(),
  }

  if (bio !== undefined) updateData.bio = bio || null
  if (phone !== undefined) updateData.phone = phone || null
  if (avatar !== undefined) updateData.avatar = avatar || null

  await db
    .update(app_users)
    .set(updateData)
    .where(eq(app_users.userId, session.user.id))

  return NextResponse.json({ success: true })
}