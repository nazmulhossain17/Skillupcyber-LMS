// app/api/student/dashboard-stats/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { enrollments, app_users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

// Helper: Get app_user ID from userId
async function getAppUserId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    console.log('📊 Fetching dashboard stats');

    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const appUserId = await getAppUserId(session.user.id);
    if (!appUserId) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Get total enrollments
    const [enrollmentStats] = await db
      .select({
        totalCourses: sql<number>`count(*)::int`,
      })
      .from(enrollments)
      .where(eq(enrollments.appUserId, appUserId));

    const totalCourses = enrollmentStats?.totalCourses || 0;

    // For now, use placeholder values for other stats
    // TODO: Implement lesson_progress table to track actual progress
    const stats = {
      totalCourses: totalCourses,
      completedCourses: 0, // TODO: Calculate from lesson progress
      inProgressCourses: totalCourses, // For now, assume all are in progress
      totalLessonsCompleted: 0, // TODO: Calculate from lesson progress
      totalWatchTime: 0, // TODO: Track video watch time
      currentStreak: 0, // TODO: Track daily learning streak
    };

    console.log('✅ Dashboard stats retrieved');

    return NextResponse.json({
      stats: stats,
    });

  } catch (error) {
    console.error("❌ GET Dashboard Stats Error:", error);
    return NextResponse.json(
      { error: "Failed to load dashboard stats" },
      { status: 500 }
    );
  }
}