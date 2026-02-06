// app/api/reviews/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { reviews, courses, app_users } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";
import arcjet, { fixedWindow } from "@/lib/arcjet";

// ========================================
// Arcjet Protection
// ========================================
const aj = arcjet.withRule(
  fixedWindow({
    mode: "LIVE",
    window: "1m",
    max: 5, // 5 reviews per minute
  })
);

// ========================================
// Validation Schema
// ========================================
const createReviewSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  rating: z.number().int().min(1).max(5, "Rating must be between 1 and 5"),
  comment: z.string().min(10, "Review must be at least 10 characters").max(1000),
});

// ========================================
// POST - Create Review (with auth error handling)
// ========================================
export async function POST(req: NextRequest) {
  try {
    // Auth check with error handling
    let session;
    try {
      session = await auth.api.getSession({ headers: req.headers });
    } catch (authError) {
      console.error("Auth error in POST review:", authError);
      return NextResponse.json({ error: "Authentication service unavailable" }, { status: 503 });
    }

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Arcjet protection
    const decision = await aj.protect(req, {
      fingerprint: session.user.id,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return NextResponse.json(
          { error: "Too many reviews. Please try again later." },
          { status: 429 }
        );
      }
      return NextResponse.json({ error: "Request blocked" }, { status: 403 });
    }

    // Parse and validate
    const body = await req.json();
    const parsed = createReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { courseId, rating, comment } = parsed.data;

    // Step 1: Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Step 2: Verify course exists
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Step 3: Check if already reviewed
    const [existingReview] = await db
      .select()
      .from(reviews)
      .where(
        and(
          eq(reviews.appUserId, appUser.id),
          eq(reviews.courseId, courseId)
        )
      )
      .limit(1);

    if (existingReview) {
      return NextResponse.json(
        { error: "You have already reviewed this course" },
        { status: 409 }
      );
    }

    // Step 4: Create review
    const [newReview] = await db
      .insert(reviews)
      .values({
        appUserId: appUser.id,
        courseId,
        rating,
        comment: comment.trim(),
      })
      .returning();

    // Step 5: Update course rating
    const reviewStats = await db
      .select({
        avgRating: sql<number>`AVG(${reviews.rating})`,
        count: sql<number>`COUNT(*)`,
      })
      .from(reviews)
      .where(eq(reviews.courseId, courseId));

    if (reviewStats.length > 0 && reviewStats[0]) {
      const avgRating = Number(reviewStats[0].avgRating) || 0;
      const reviewCount = Number(reviewStats[0].count) || 0;

      await db
        .update(courses)
        .set({
          averageRating: avgRating.toFixed(2),
          reviewCount: reviewCount,
        })
        .where(eq(courses.id, courseId));
    }

    // Step 6: Get user details for response
    const reviewWithUser = {
      ...newReview,
      userName: appUser.name || "Anonymous",
      userAvatar: appUser.avatar || "",
    };

    return NextResponse.json({
      success: true,
      review: reviewWithUser,
      message: "Review created successfully",
    });

  } catch (error: any) {
    console.error("Review creation error:", error);
    return NextResponse.json(
      { 
        error: "Failed to create review", 
        details: error.message 
      },
      { status: 500 }
    );
  }
}

// ========================================
// GET - List Reviews (accepts slug or UUID)
// ========================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseIdOrSlug = searchParams.get("courseId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");

    if (!courseIdOrSlug) {
      return NextResponse.json(
        { error: "courseId is required" },
        { status: 400 }
      );
    }

    // ✅ Detect if it's a UUID or slug
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(courseIdOrSlug);
    
    let courseId: string;
    
    if (isUUID) {
      // Already a UUID, use directly
      courseId = courseIdOrSlug;
    } else {
      // It's a slug, look up the course ID
      const [course] = await db
        .select({ id: courses.id })
        .from(courses)
        .where(eq(courses.slug, courseIdOrSlug))
        .limit(1);
      
      if (!course) {
        // Course not found by slug - return empty reviews instead of error
        // This allows preview page to load even if course doesn't exist yet
        return NextResponse.json({
          success: true,
          reviews: [],
          pagination: {
            limit,
            offset,
            total: 0,
          },
        });
      }
      
      courseId = course.id;
    }

    // Fetch reviews with user details (JOIN)
    const reviewsList = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        userId: reviews.appUserId,
        userName: app_users.name,
        userAvatar: app_users.avatar,
      })
      .from(reviews)
      .leftJoin(app_users, eq(reviews.appUserId, app_users.id))
      .where(eq(reviews.courseId, courseId))
      .orderBy(desc(reviews.createdAt))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      reviews: reviewsList,
      pagination: {
        limit,
        offset,
        total: reviewsList.length,
      },
    });

  } catch (error: any) {
    console.error("Fetch reviews error:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch reviews",
        details: error.message 
      },
      { status: 500 }
    );
  }
}