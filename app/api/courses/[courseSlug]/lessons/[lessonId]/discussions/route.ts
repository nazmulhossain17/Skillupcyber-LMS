// app/api/courses/[courseSlug]/lessons/[lessonId]/discussions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { discussions, discussionReplies, app_users, lessons, courses } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
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
// GET – Get All Discussions for a Lesson
// ---------------------------------------------------------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; lessonId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, lessonId } = params;

    console.log('📖 Fetching discussions for lesson:', lessonId);

    // Verify lesson exists
    const [lesson] = await db
      .select({ 
        id: lessons.id,
        courseId: lessons.courseId 
      })
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1);

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    // Get all discussions for this lesson with user info
    const lessonDiscussions = await db
      .select({
        id: discussions.id,
        title: discussions.title,
        content: discussions.content,
        isPinned: discussions.isPinned,
        isResolved: discussions.isResolved,
        viewCount: discussions.viewCount,
        createdAt: discussions.createdAt,
        updatedAt: discussions.updatedAt,
        user: {
          id: app_users.id,
          name: app_users.name,
          avatar: app_users.avatar,
          role: app_users.role,
        },
      })
      .from(discussions)
      .leftJoin(app_users, eq(discussions.appUserId, app_users.id))
      .where(eq(discussions.lessonId, lessonId))
      .orderBy(desc(discussions.isPinned), desc(discussions.createdAt));

    // Get reply counts for each discussion
    const discussionsWithReplies = await Promise.all(
      lessonDiscussions.map(async (discussion) => {
        const replies = await db
          .select({
            id: discussionReplies.id,
          })
          .from(discussionReplies)
          .where(eq(discussionReplies.discussionId, discussion.id));

        return {
          ...discussion,
          replyCount: replies.length,
        };
      })
    );

    console.log(`✅ Retrieved ${discussionsWithReplies.length} discussions`);

    return NextResponse.json({ 
      discussions: discussionsWithReplies 
    });

  } catch (error) {
    console.error("❌ GET Discussions Error:", error);
    return NextResponse.json(
      { error: "Failed to load discussions" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------
// POST – Create New Discussion
// ---------------------------------------------------------
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; lessonId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, lessonId } = params;

    console.log('➕ Creating discussion for lesson:', lessonId);

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

    // Verify lesson exists and get course ID
    const [lesson] = await db
      .select({ 
        id: lessons.id,
        courseId: lessons.courseId 
      })
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1);

    if (!lesson) {
      return NextResponse.json(
        { error: "Lesson not found" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { title, content } = body;

    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json(
        { error: "Title and content are required" },
        { status: 400 }
      );
    }

    // Create discussion
    const [newDiscussion] = await db
      .insert(discussions)
      .values({
        appUserId,
        courseId: lesson.courseId,
        lessonId,
        title: title.trim(),
        content: content.trim(),
        isPinned: false,
        isResolved: false,
        viewCount: 0,
      })
      .returning();

    console.log('✅ Discussion created:', newDiscussion.id);

    // Get user info for response
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

    return NextResponse.json({
      discussion: {
        ...newDiscussion,
        user,
        replyCount: 0,
      },
    }, { status: 201 });

  } catch (error) {
    console.error("❌ POST Discussion Error:", error);
    return NextResponse.json(
      { error: "Failed to create discussion" },
      { status: 500 }
    );
  }
}