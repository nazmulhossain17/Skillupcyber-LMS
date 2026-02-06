// ============================================
// FILE: app/api/reviews/check/route.ts
// Check if current user has reviewed a course
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { reviews, app_users, courses } from "@/db/schema";
import { eq, and } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseIdOrSlug = searchParams.get("courseId");

    if (!courseIdOrSlug) {
      return NextResponse.json(
        { error: "courseId is required" },
        { status: 400 }
      );
    }

    // Auth check
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({
        success: true,
        hasReviewed: false,
        review: null,
      });
    }

    // Get app_user
    const [appUser] = await db
      .select({ id: app_users.id })
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({
        success: true,
        hasReviewed: false,
        review: null,
      });
    }

    // Detect if it's a UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseIdOrSlug);
    
    let courseId: string;
    
    if (isUUID) {
      courseId = courseIdOrSlug;
    } else {
      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.slug, courseIdOrSlug))
        .limit(1);
      
      if (!course) {
        return NextResponse.json({
          success: true,
          hasReviewed: false,
          review: null,
        });
      }
      
      courseId = course.id;
    }

    // Check if user has reviewed this course
    const [existingReview] = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
      })
      .from(reviews)
      .where(
        and(
          eq(reviews.appUserId, appUser.id),
          eq(reviews.courseId, courseId)
        )
      )
      .limit(1);

    return NextResponse.json({
      success: true,
      hasReviewed: !!existingReview,
      review: existingReview || null,
    });

  } catch (error: any) {
    console.error("Check review error:", error);
    return NextResponse.json(
      { error: "Failed to check review status", details: error.message },
      { status: 500 }
    );
  }
}