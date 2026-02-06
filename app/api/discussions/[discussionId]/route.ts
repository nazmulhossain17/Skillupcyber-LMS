// app/api/discussions/[discussionId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { discussions, discussionReplies, app_users } from "@/db/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { z } from "zod";

// ========================================
// Validation Schemas
// ========================================
const updateDiscussionSchema = z.object({
  title: z.string().min(5).max(200).optional(),
  content: z.string().min(10).max(5000).optional(),
  isResolved: z.boolean().optional(),
  isPinned: z.boolean().optional(),
});

// ========================================
// GET - Get Single Discussion with Replies
// ========================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ discussionId: string }> }
) {
  try {
    const { discussionId } = await params;

    // Get discussion
    const [discussion] = await db
      .select({
        id: discussions.id,
        title: discussions.title,
        content: discussions.content,
        isPinned: discussions.isPinned,
        isResolved: discussions.isResolved,
        viewCount: discussions.viewCount,
        createdAt: discussions.createdAt,
        updatedAt: discussions.updatedAt,
        courseId: discussions.courseId,
        lessonId: discussions.lessonId,
        userId: app_users.id,
        userName: app_users.name,
        userAvatar: app_users.avatar,
        userRole: app_users.role,
      })
      .from(discussions)
      .leftJoin(app_users, eq(discussions.appUserId, app_users.id))
      .where(eq(discussions.id, discussionId))
      .limit(1);

    if (!discussion) {
      return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
    }

    // Increment view count (fire and forget)
    db.update(discussions)
      .set({
        viewCount: sql`${discussions.viewCount} + 1`,
      })
      .where(eq(discussions.id, discussionId))
      .execute()
      .catch(err => console.error('Failed to update view count:', err));

    // Get replies
    const replies = await db
      .select({
        id: discussionReplies.id,
        content: discussionReplies.content,
        isInstructorReply: discussionReplies.isInstructorReply,
        isBestAnswer: discussionReplies.isBestAnswer,
        createdAt: discussionReplies.createdAt,
        updatedAt: discussionReplies.updatedAt,
        userId: app_users.id,
        userName: app_users.name,
        userAvatar: app_users.avatar,
        userRole: app_users.role,
      })
      .from(discussionReplies)
      .leftJoin(app_users, eq(discussionReplies.appUserId, app_users.id))
      .where(eq(discussionReplies.discussionId, discussionId))
      .orderBy(desc(discussionReplies.isBestAnswer), discussionReplies.createdAt);

    return NextResponse.json({
      success: true,
      discussion: { ...discussion, replies },
    });
  } catch (error: any) {
    console.error("Get discussion error:", error);
    return NextResponse.json(
      { error: "Failed to fetch discussion", details: error.message },
      { status: 500 }
    );
  }
}

// ========================================
// PATCH - Update Discussion (No Transaction)
// ========================================
export async function PATCH(
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
    const parsed = updateDiscussionSchema.safeParse(body);

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

    // Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get existing discussion
    const [existingDiscussion] = await db
      .select()
      .from(discussions)
      .where(eq(discussions.id, discussionId))
      .limit(1);

    if (!existingDiscussion) {
      return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
    }

    // Verify ownership (or instructor/admin)
    const isOwner = existingDiscussion.appUserId === appUser.id;
    const canModerate = appUser.role === "instructor" || appUser.role === "admin";

    if (!isOwner && !canModerate) {
      return NextResponse.json(
        { error: "You can only edit your own discussions" },
        { status: 403 }
      );
    }

    // Only moderators can pin/resolve
    if ((updates.isPinned !== undefined || updates.isResolved !== undefined) && !canModerate) {
      return NextResponse.json(
        { error: "Only instructors and admins can pin or resolve discussions" },
        { status: 403 }
      );
    }

    // Update discussion
    const [updatedDiscussion] = await db
      .update(discussions)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(discussions.id, discussionId))
      .returning();

    return NextResponse.json({
      success: true,
      message: "Discussion updated successfully",
      discussion: updatedDiscussion,
    });
  } catch (error: any) {
    console.error("Update discussion error:", error);
    return NextResponse.json(
      { error: "Failed to update discussion", details: error.message },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Delete Discussion (No Transaction)
// ========================================
export async function DELETE(
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

    // Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get existing discussion
    const [existingDiscussion] = await db
      .select()
      .from(discussions)
      .where(eq(discussions.id, discussionId))
      .limit(1);

    if (!existingDiscussion) {
      return NextResponse.json({ error: "Discussion not found" }, { status: 404 });
    }

    // Verify ownership (or moderator)
    const isOwner = existingDiscussion.appUserId === appUser.id;
    const canModerate = appUser.role === "instructor" || appUser.role === "admin";

    if (!isOwner && !canModerate) {
      return NextResponse.json(
        { error: "You can only delete your own discussions" },
        { status: 403 }
      );
    }

    // Delete replies first (if no cascade)
    await db.delete(discussionReplies).where(eq(discussionReplies.discussionId, discussionId));

    // Delete discussion
    await db.delete(discussions).where(eq(discussions.id, discussionId));

    return NextResponse.json({
      success: true,
      message: "Discussion deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete discussion error:", error);
    return NextResponse.json(
      { error: "Failed to delete discussion", details: error.message },
      { status: 500 }
    );
  }
}