// app/api/discussions/[discussionId]/replies/[replyId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { discussionReplies, discussions, app_users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// ========================================
// Validation Schemas
// ========================================
const updateReplySchema = z.object({
  content: z.string().min(5).max(2000).optional(),
  isBestAnswer: z.boolean().optional(),
});

// ========================================
// PATCH - Update Reply (No Transaction)
// ========================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ discussionId: string; replyId: string }> }
) {
  try {
    const { discussionId, replyId } = await params;

    // Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse and validate
    const body = await req.json();
    const parsed = updateReplySchema.safeParse(body);

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

    // Get existing reply
    const [existingReply] = await db
      .select()
      .from(discussionReplies)
      .where(
        and(
          eq(discussionReplies.id, replyId),
          eq(discussionReplies.discussionId, discussionId)
        )
      )
      .limit(1);

    if (!existingReply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
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

    // Verify permissions
    const isReplyOwner = existingReply.appUserId === appUser.id;
    const isDiscussionOwner = discussion.appUserId === appUser.id;
    const canModerate = appUser.role === "instructor" || appUser.role === "admin";

    // Content update: Only reply owner or moderator
    if (updates.content !== undefined && !isReplyOwner && !canModerate) {
      return NextResponse.json(
        { error: "You can only edit your own replies" },
        { status: 403 }
      );
    }

    // Best answer: Only discussion owner or moderator
    if (updates.isBestAnswer !== undefined && !isDiscussionOwner && !canModerate) {
      return NextResponse.json(
        { error: "Only the discussion author can mark best answer" },
        { status: 403 }
      );
    }

    // If marking as best answer, unmark other replies first
    if (updates.isBestAnswer === true) {
      await db
        .update(discussionReplies)
        .set({ isBestAnswer: false })
        .where(
          and(
            eq(discussionReplies.discussionId, discussionId),
            eq(discussionReplies.isBestAnswer, true)
          )
        );

      // Mark discussion as resolved
      await db
        .update(discussions)
        .set({ isResolved: true })
        .where(eq(discussions.id, discussionId));
    }

    // If unmarking best answer, unresolve discussion
    if (updates.isBestAnswer === false) {
      await db
        .update(discussions)
        .set({ isResolved: false })
        .where(eq(discussions.id, discussionId));
    }

    // Update reply
    const [updatedReply] = await db
      .update(discussionReplies)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(discussionReplies.id, replyId))
      .returning();

    return NextResponse.json({
      success: true,
      message: "Reply updated successfully",
      reply: updatedReply,
    });
  } catch (error: any) {
    console.error("Update reply error:", error);
    return NextResponse.json(
      { error: "Failed to update reply", details: error.message },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Delete Reply (No Transaction)
// ========================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ discussionId: string; replyId: string }> }
) {
  try {
    const { discussionId, replyId } = await params;

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

    // Get existing reply
    const [existingReply] = await db
      .select()
      .from(discussionReplies)
      .where(
        and(
          eq(discussionReplies.id, replyId),
          eq(discussionReplies.discussionId, discussionId)
        )
      )
      .limit(1);

    if (!existingReply) {
      return NextResponse.json({ error: "Reply not found" }, { status: 404 });
    }

    // Verify ownership (or moderator)
    const isOwner = existingReply.appUserId === appUser.id;
    const canModerate = appUser.role === "instructor" || appUser.role === "admin";

    if (!isOwner && !canModerate) {
      return NextResponse.json(
        { error: "You can only delete your own replies" },
        { status: 403 }
      );
    }

    // If deleting best answer, unresolve discussion
    if (existingReply.isBestAnswer) {
      await db
        .update(discussions)
        .set({ isResolved: false })
        .where(eq(discussions.id, discussionId));
    }

    // Delete reply
    await db.delete(discussionReplies).where(eq(discussionReplies.id, replyId));

    return NextResponse.json({
      success: true,
      message: "Reply deleted successfully",
    });
  } catch (error: any) {
    console.error("Delete reply error:", error);
    return NextResponse.json(
      { error: "Failed to delete reply", details: error.message },
      { status: 500 }
    );
  }
}