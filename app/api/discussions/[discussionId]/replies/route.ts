// app/api/discussions/[discussionId]/replies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { discussionReplies, discussions, app_users, enrollments, courses } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// ========================================
// Validation Schema
// ========================================
const createReplySchema = z.object({
  content: z.string().min(5, "Reply must be at least 5 characters").max(2000),
});

// ========================================
// POST - Create Reply (No Transaction)
// ========================================
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ discussionId: string }> }
) {
  try {
    const { discussionId } = await params;

    // Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate
    const body = await req.json();
    const parsed = createReplySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { content } = parsed.data;

    // Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get discussion
    const [discussion] = await db
      .select()
      .from(discussions)
      .where(eq(discussions.id, discussionId))
      .limit(1);

    if (!discussion) {
      return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
    }

    // Check if user is instructor of the course
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, discussion.courseId))
      .limit(1);

    const isInstructor = course && course.instructorId === appUser.id;
    const isAdmin = appUser.role === "admin";

    // If not instructor/admin, check enrollment
    if (!isInstructor && !isAdmin) {
      const [enrollment] = await db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.appUserId, appUser.id),
            eq(enrollments.courseId, discussion.courseId),
            eq(enrollments.status, "active")
          )
        )
        .limit(1);

      if (!enrollment) {
        return NextResponse.json(
          { error: "You must be enrolled in this course to reply" },
          { status: 403 }
        );
      }
    }

    // Create reply
    const [reply] = await db
      .insert(discussionReplies)
      .values({
        discussionId,
        appUserId: appUser.id,
        content,
        isInstructorReply: isInstructor || appUser.role === "instructor",
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: "Reply posted successfully",
      reply,
    }, { status: 201 });

  } catch (error: any) {
    console.error("Create reply error:", error);
    return NextResponse.json(
      { error: "Failed to create reply", details: error.message },
      { status: 500 }
    );
  }
}