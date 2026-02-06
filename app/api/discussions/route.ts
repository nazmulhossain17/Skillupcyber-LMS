// app/api/discussions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { discussions, discussionReplies, courses, app_users, enrollments } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";

// ========================================
// Validation Schema
// ========================================
const createDiscussionSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  lessonId: z.string().uuid("Invalid lesson ID").optional(),
  title: z.string().min(5, "Title must be at least 5 characters").max(200),
  content: z.string().min(10, "Content must be at least 10 characters").max(5000),
});

// ========================================
// POST - Create Discussion (No Transaction)
// ========================================
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate
    const body = await req.json();
    const parsed = createDiscussionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { courseId, lessonId, title, content } = parsed.data;

    // Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify course exists
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Check if user is enrolled or is instructor/admin
    const isInstructor = course.instructorId === appUser.id;
    const isAdmin = appUser.role === "admin";

    if (!isInstructor && !isAdmin) {
      // Check enrollment for students
      const [enrollment] = await db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.appUserId, appUser.id),
            eq(enrollments.courseId, courseId),
            eq(enrollments.status, "active")
          )
        )
        .limit(1);

      if (!enrollment) {
        return NextResponse.json(
          { error: "You must be enrolled in this course to create discussions" },
          { status: 403 }
        );
      }
    }

    // Create discussion
    const [discussion] = await db
      .insert(discussions)
      .values({
        appUserId: appUser.id,
        courseId,
        lessonId: lessonId || null,
        title,
        content,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: "Discussion created successfully",
      discussion,
    }, { status: 201 });

  } catch (error: any) {
    console.error("Create discussion error:", error);
    return NextResponse.json(
      { error: "Failed to create discussion", details: error.message },
      { status: 500 }
    );
  }
}

// ========================================
// GET - Get Discussions
// ========================================
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const courseId = searchParams.get("courseId");
    const lessonId = searchParams.get("lessonId");
    const userId = searchParams.get("userId");
    const limit = parseInt(searchParams.get("limit") || "20");
    const offset = parseInt(searchParams.get("offset") || "0");
    const sort = searchParams.get("sort") || "recent"; // recent, popular

    // Build query conditions
    const conditions = [];
    if (courseId) conditions.push(eq(discussions.courseId, courseId));
    if (lessonId) conditions.push(eq(discussions.lessonId, lessonId));
    if (userId) conditions.push(eq(discussions.appUserId, userId));

    // Get discussions with user info and reply count
    const discussionsList = await db
      .select({
        id: discussions.id,
        title: discussions.title,
        content: discussions.content,
        isPinned: discussions.isPinned,
        isResolved: discussions.isResolved,
        viewCount: discussions.viewCount,
        createdAt: discussions.createdAt,
        updatedAt: discussions.updatedAt,
        // User info
        userId: app_users.id,
        userName: app_users.name,
        userAvatar: app_users.avatar,
        userRole: app_users.role,
        // Course info
        courseId: courses.id,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        // Reply count
        replyCount: sql<number>`(
          SELECT COUNT(*)::integer 
          FROM ${discussionReplies} 
          WHERE ${discussionReplies.discussionId} = ${discussions.id}
        )`,
      })
      .from(discussions)
      .leftJoin(app_users, eq(discussions.appUserId, app_users.id))
      .leftJoin(courses, eq(discussions.courseId, courses.id))
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(
        sort === "popular"
          ? desc(discussions.viewCount)
          : desc(discussions.createdAt)
      )
      .limit(limit)
      .offset(offset);

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)::integer` })
      .from(discussions)
      .where(conditions.length > 0 ? and(...conditions) : undefined);

    const total = countResult[0]?.count || 0;

    return NextResponse.json({
      success: true,
      discussions: discussionsList,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    console.error("Get discussions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch discussions", details: error.message },
      { status: 500 }
    );
  }
}