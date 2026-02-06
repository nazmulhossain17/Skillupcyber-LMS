// app/api/enrollments/check/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { enrollments, app_users } from "@/db/schema";
import { eq, and } from "drizzle-orm";

// ========================================
// POST - Check if User is Enrolled in Course
// ========================================
export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Get courseId from request body
    const { courseId } = await req.json();

    if (!courseId) {
      return NextResponse.json(
        { error: "Course ID is required" },
        { status: 400 }
      );
    }

    // 4. Check enrollment
    const [enrollment] = await db
      .select({
        id: enrollments.id,
        status: enrollments.status,
        progressPercent: enrollments.progressPercent,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        expiresAt: enrollments.expiresAt,
      })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.appUserId, appUser.id),
          eq(enrollments.courseId, courseId)
        )
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json({
        enrolled: false,
        enrollment: null,
      });
    }

    // 5. Check if enrollment is valid
    const isActive = enrollment.status === "active" || enrollment.status === "completed";
    const isExpired = enrollment.expiresAt && new Date(enrollment.expiresAt) < new Date();

    return NextResponse.json({
      enrolled: true,
      isActive: isActive && !isExpired,
      isExpired,
      enrollment,
    });
  } catch (error: any) {
    console.error("Check enrollment error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}