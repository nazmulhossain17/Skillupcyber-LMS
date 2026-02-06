// app/api/profile/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { app_users } from "@/db/schema";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { name, role, bio, phone, country, timezone, avatar } = body;

    // Upsert app_user profile
    const [profile] = await db
      .insert(app_users)
      .values({
        userId: session.user.id,
        name,
        role,
        bio: bio || null,
        phone: phone || null,
        country: country || null,
        timezone: timezone || null,
        avatar: avatar || null,
      })
      .onConflictDoUpdate({
        target: app_users.userId,
        set: {
          name,
          role,
          bio: bio || null,
          phone: phone || null,
          country: country || null,
          timezone: timezone || null,
          avatar: avatar || null,
          updatedAt: new Date(),
        },
      })
      .returning();

    // Decide redirect based on role
    let redirectTo = "/dashboard"; // default

    if (profile.role === "instructor") {
      redirectTo = "/instructor";
    } else if (profile.role === "admin") {
      redirectTo = "/admin";
    } else if (profile.role === "student") {
      redirectTo = "/dashboard";
    }

    // Return success + redirect URL
    return NextResponse.json(
      {
        success: true,
        message: "Profile created successfully",
        redirectTo,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Profile creation error:", error);
    return NextResponse.json(
      { error: "Failed to create profile" },
      { status: 500 }
    );
  }
}
