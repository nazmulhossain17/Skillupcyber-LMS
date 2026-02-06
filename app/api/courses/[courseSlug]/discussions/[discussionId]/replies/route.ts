// app/api/courses/[courseSlug]/discussions/[discussionId]/replies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { discussionReplies, app_users, discussions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
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

// ---------------------------------------------------------
// GET – Get All Replies for a Discussion
// ---------------------------------------------------------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; discussionId: string }> }
) {
  try {
    const params = await context.params;
    const { discussionId } = params;

    console.log('📖 Fetching replies for discussion:', discussionId);

    // Get all replies with user info
    const replies = await db
      .select({
        id: discussionReplies.id,
        content: discussionReplies.content,
        isInstructorReply: discussionReplies.isInstructorReply,
        isBestAnswer: discussionReplies.isBestAnswer,
        createdAt: discussionReplies.createdAt,
        updatedAt: discussionReplies.updatedAt,
        user: {
          id: app_users.id,
          name: app_users.name,
          avatar: app_users.avatar,
          role: app_users.role,
        },
      })
      .from(discussionReplies)
      .leftJoin(app_users, eq(discussionReplies.appUserId, app_users.id))
      .where(eq(discussionReplies.discussionId, discussionId))
      .orderBy(desc(discussionReplies.isBestAnswer), discussionReplies.createdAt);

    console.log(`✅ Retrieved ${replies.length} replies`);

    return NextResponse.json({ replies });

  } catch (error) {
    console.error("❌ GET Replies Error:", error);
    return NextResponse.json(
      { error: "Failed to load replies" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------
// POST – Create New Reply
// ---------------------------------------------------------
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; discussionId: string }> }
) {
  try {
    const params = await context.params;
    const { discussionId } = params;

    console.log('➕ Creating reply for discussion:', discussionId);

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

    // Verify discussion exists
    const [discussion] = await db
      .select({ id: discussions.id })
      .from(discussions)
      .where(eq(discussions.id, discussionId))
      .limit(1);

    if (!discussion) {
      return NextResponse.json(
        { error: "Discussion not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    // Get user info to check if instructor
    const [user] = await db
      .select({
        id: app_users.id,
        name: app_users.name,
        avatar: app_users.avatar,
        role: app_users.role,
      })
      .from(app_users)
      .where(eq(app_users.id, appUserId))
      .limit(1);

    // Create reply
    const [newReply] = await db
      .insert(discussionReplies)
      .values({
        discussionId,
        appUserId,
        content: content.trim(),
        isInstructorReply: user?.role === 'instructor',
        isBestAnswer: false,
      })
      .returning();

    console.log('✅ Reply created:', newReply.id);

    return NextResponse.json({
      reply: {
        ...newReply,
        user,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("❌ POST Reply Error:", error);
    return NextResponse.json(
      { error: "Failed to create reply" },
      { status: 500 }
    );
  }
}