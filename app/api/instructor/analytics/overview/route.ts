// app/api/instructor/analytics/overview/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { 
  courses, 
  enrollments, 
  payments, 
  reviews, 
  app_users,
} from "@/db/schema";
import { eq, and, desc, sql, gte } from "drizzle-orm";
import { auth } from "@/lib/auth";

// Helper: Get instructor ID
async function getInstructorId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id, role: app_users.role })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);

  if (!user || user.role !== 'instructor') return null;
  return user.id;
}

// Cache key generator
const getCacheKey = (instructorId: string, type: string) => 
  `analytics:${instructorId}:${type}:${new Date().toISOString().split('T')[0]}`;

// GET - Analytics Overview
export async function GET(req: NextRequest) {
  try {
    console.log("📊 [Analytics Overview] Starting...");
    
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      console.error("❌ Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      console.error("❌ Not an instructor");
      return NextResponse.json({ error: "Instructor access required" }, { status: 403 });
    }

    console.log("✅ Instructor ID:", instructorId);

    // Time periods
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    // Parallel queries for performance
    const [
      totalStats,
      recentEnrollments,
      revenueStats,
      topCourses,
      recentReviews
    ] = await Promise.all([
      // 1. Total Statistics
      db
        .select({
          totalCourses: sql<number>`COUNT(DISTINCT ${courses.id})`,
          totalStudents: sql<number>`COUNT(DISTINCT ${enrollments.appUserId})`,
          totalRevenue: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
          avgRating: sql<string>`COALESCE(AVG(${reviews.rating}), 0)`,
        })
        .from(courses)
        .leftJoin(enrollments, eq(courses.id, enrollments.courseId))
        .leftJoin(payments, and(
          eq(payments.courseId, courses.id),
          eq(payments.status, 'succeeded')
        ))
        .leftJoin(reviews, eq(reviews.courseId, courses.id))
        .where(eq(courses.instructorId, instructorId)),

      // 2. Recent Enrollments (Last 30 days)
      db
        .select({
          count: sql<number>`COUNT(*)`,
        })
        .from(enrollments)
        .innerJoin(courses, eq(courses.id, enrollments.courseId))
        .where(
          and(
            eq(courses.instructorId, instructorId),
            gte(enrollments.enrolledAt, last30Days)
          )
        ),

      // 3. Revenue Stats
      db
        .select({
          last30Days: sql<string>`COALESCE(SUM(CASE WHEN ${payments.createdAt} >= ${last30Days} THEN ${payments.amount} ELSE 0 END), 0)`,
          last7Days: sql<string>`COALESCE(SUM(CASE WHEN ${payments.createdAt} >= ${last7Days} THEN ${payments.amount} ELSE 0 END), 0)`,
        })
        .from(payments)
        .innerJoin(courses, eq(courses.id, payments.courseId))
        .where(
          and(
            eq(courses.instructorId, instructorId),
            eq(payments.status, 'succeeded')
          )
        ),

      // 4. Top Performing Courses
      db
        .select({
          id: courses.id,
          title: courses.title,
          slug: courses.slug,
          thumbnail: courses.thumbnail,
          enrollmentCount: sql<number>`COUNT(DISTINCT ${enrollments.id})`,
          revenue: sql<string>`COALESCE(SUM(${payments.amount}), 0)`,
          avgRating: courses.averageRating,
          reviewCount: courses.reviewCount,
        })
        .from(courses)
        .leftJoin(enrollments, eq(courses.id, enrollments.courseId))
        .leftJoin(payments, and(
          eq(payments.courseId, courses.id),
          eq(payments.status, 'succeeded')
        ))
        .where(eq(courses.instructorId, instructorId))
        .groupBy(courses.id)
        .orderBy(desc(sql`COUNT(DISTINCT ${enrollments.id})`))
        .limit(5),

      // 5. Recent Reviews
      db
        .select({
          id: reviews.id,
          rating: reviews.rating,
          comment: reviews.comment,
          createdAt: reviews.createdAt,
          courseName: courses.title,
          studentName: app_users.name,
          studentAvatar: app_users.avatar,
        })
        .from(reviews)
        .innerJoin(courses, eq(courses.id, reviews.courseId))
        .innerJoin(app_users, eq(app_users.id, reviews.appUserId))
        .where(eq(courses.instructorId, instructorId))
        .orderBy(desc(reviews.createdAt))
        .limit(5),
    ]);

    const stats = totalStats[0];
    const enrollmentGrowth = recentEnrollments[0];
    const revenue = revenueStats[0];

    // Calculate growth rates
    const enrollmentGrowthRate = enrollmentGrowth.count > 0 
      ? ((enrollmentGrowth.count / (stats.totalStudents || 1)) * 100).toFixed(1)
      : "0";

    const response = {
      overview: {
        totalCourses: Number(stats.totalCourses),
        totalStudents: Number(stats.totalStudents),
        totalRevenue: parseFloat(stats.totalRevenue || "0"),
        averageRating: parseFloat(stats.avgRating || "0").toFixed(1),
        enrollmentGrowth: {
          count: enrollmentGrowth.count,
          rate: enrollmentGrowthRate,
        },
      },
      revenue: {
        total: parseFloat(stats.totalRevenue || "0"),
        last30Days: parseFloat(revenue.last30Days || "0"),
        last7Days: parseFloat(revenue.last7Days || "0"),
      },
      topCourses: topCourses.map(course => ({
        id: course.id,
        title: course.title,
        slug: course.slug,
        thumbnail: course.thumbnail,
        enrollments: Number(course.enrollmentCount),
        revenue: parseFloat(course.revenue || "0"),
        rating: parseFloat(course.avgRating || "0"),
        reviews: course.reviewCount,
      })),
      recentReviews: recentReviews.map(review => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        course: review.courseName,
        student: {
          name: review.studentName,
          avatar: review.studentAvatar,
        },
      })),
    };

    console.log("✅ Analytics fetched successfully");
    return NextResponse.json(response);

  } catch (error) {
    console.error("❌ Analytics Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}