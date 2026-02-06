// app/api/reviews/[reviewId]/route.ts
// Fixed: Removed transactions for neon-http driver compatibility
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { reviews, courses, app_users } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";

// ========================================
// Validation Schema
// ========================================
const updateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5).optional(),
  comment: z.string().min(10).max(1000).optional(),
});

// ========================================
// GET - Get Single Review
// ========================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;

    const [review] = await db
      .select({
        id: reviews.id,
        rating: reviews.rating,
        comment: reviews.comment,
        createdAt: reviews.createdAt,
        updatedAt: reviews.updatedAt,
        userId: app_users.id,
        userName: app_users.name,
        userAvatar: app_users.avatar,
        courseId: courses.id,
        courseTitle: courses.title,
      })
      .from(reviews)
      .leftJoin(app_users, eq(reviews.appUserId, app_users.id))
      .leftJoin(courses, eq(reviews.courseId, courses.id))
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true, review });
  } catch (error: any) {
    console.error("Get review error:", error);
    return NextResponse.json(
      { error: "Failed to fetch review", details: error.message },
      { status: 500 }
    );
  }
}

// ========================================
// PATCH - Update Review (No Transaction)
// ========================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;

    // Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate
    const body = await req.json();
    const parsed = updateReviewSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updates = parsed.data;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    // Step 1: Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Step 2: Get existing review
    const [existingReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Step 3: Verify ownership
    if (existingReview.appUserId !== appUser.id) {
      return NextResponse.json(
        { error: "You can only edit your own reviews" },
        { status: 403 }
      );
    }

    // Step 4: Update review
    const [updatedReview] = await db
      .update(reviews)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(reviews.id, reviewId))
      .returning();

    // Step 5: Recalculate course average rating if rating changed
    if (updates.rating !== undefined) {
      const result = await db
        .select({
          avgRating: sql<number>`AVG(${reviews.rating})::numeric`,
          totalReviews: sql<number>`COUNT(*)::integer`,
        })
        .from(reviews)
        .where(eq(reviews.courseId, existingReview.courseId));

      if (result[0]) {
        const avgRating = result[0].avgRating || 0;
        const totalReviews = result[0].totalReviews || 0;

        await db
          .update(courses)
          .set({
            averageRating: Number(avgRating).toFixed(2),
            reviewCount: totalReviews,
          })
          .where(eq(courses.id, existingReview.courseId));
      }
    }

    return NextResponse.json({
      success: true,
      message: "Review updated successfully",
      review: updatedReview,
    });

  } catch (error: any) {
    console.error("Update review error:", error);
    return NextResponse.json(
      { error: "Failed to update review", details: error.message },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Delete Review (No Transaction)
// ========================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  try {
    const { reviewId } = await params;

    // Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Step 1: Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Step 2: Get existing review
    const [existingReview] = await db
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1);

    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Step 3: Verify ownership (or admin)
    if (existingReview.appUserId !== appUser.id && appUser.role !== "admin") {
      return NextResponse.json(
        { error: "You can only delete your own reviews" },
        { status: 403 }
      );
    }

    const courseId = existingReview.courseId;

    // Step 4: Delete review
    await db.delete(reviews).where(eq(reviews.id, reviewId));

    // Step 5: Recalculate course average rating
    const result = await db
      .select({
        avgRating: sql<number>`AVG(${reviews.rating})::numeric`,
        totalReviews: sql<number>`COUNT(*)::integer`,
      })
      .from(reviews)
      .where(eq(reviews.courseId, courseId));

    if (result[0]) {
      const avgRating = result[0].avgRating || 0;
      const totalReviews = result[0].totalReviews || 0;

      await db
        .update(courses)
        .set({
          averageRating: avgRating ? Number(avgRating).toFixed(2) : "0",
          reviewCount: totalReviews,
        })
        .where(eq(courses.id, courseId));
    }

    return NextResponse.json({
      success: true,
      message: "Review deleted successfully",
    });

  } catch (error: any) {
    console.error("Delete review error:", error);
    return NextResponse.json(
      { error: "Failed to delete review", details: error.message },
      { status: 500 }
    );
  }
}