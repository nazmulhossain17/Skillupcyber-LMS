// ============================================
// FILE: app/api/courses/[courseSlug]/progress/route.ts
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { 
  courses, 
  lessons,
  enrollments,
  lessonProgress,
  app_users 
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const progressSchema = z.object({
  lessonId: z.string().uuid(),
  completed: z.boolean(),
  watchedSeconds: z.number().optional(),
});

// Helper: Get app_user ID from userId
async function getAppUserId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

// POST - Update lesson progress
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  try {
    const { courseSlug } = await params;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUserId = await getAppUserId(session.user.id);
    if (!appUserId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get course
    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, course.id),
          eq(enrollments.appUserId, appUserId)
        )
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
    }

    // Parse body
    const body = await req.json();
    const validation = progressSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid request", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { lessonId, completed, watchedSeconds } = validation.data;

    // Verify lesson belongs to course
    const [lesson] = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(
        and(
          eq(lessons.id, lessonId),
          eq(lessons.courseId, course.id)
        )
      )
      .limit(1);

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Check existing progress (composite primary key: appUserId + lessonId)
    const [existingProgress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.appUserId, appUserId),
          eq(lessonProgress.lessonId, lessonId)
        )
      )
      .limit(1);

    if (existingProgress) {
      // Update existing progress
      await db
        .update(lessonProgress)
        .set({
          completed: completed || existingProgress.completed, // Don't un-complete
          watchedSeconds: watchedSeconds ?? existingProgress.watchedSeconds,
          lastWatchedAt: new Date(),
          completedAt: completed && !existingProgress.completed ? new Date() : existingProgress.completedAt,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(lessonProgress.appUserId, appUserId),
            eq(lessonProgress.lessonId, lessonId)
          )
        );

      return NextResponse.json({ 
        success: true, 
        message: "Progress updated" 
      });
    } else {
      // Create new progress
      await db
        .insert(lessonProgress)
        .values({
          appUserId,
          lessonId,
          completed,
          watchedSeconds: watchedSeconds ?? 0,
          lastWatchedAt: new Date(),
          completedAt: completed ? new Date() : null,
        });

      return NextResponse.json({ 
        success: true, 
        message: "Progress created" 
      });
    }
  } catch (error) {
    console.error("❌ Progress Error:", error);
    return NextResponse.json(
      { error: "Failed to update progress" },
      { status: 500 }
    );
  }
}

// GET - Get all progress for course
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  try {
    const { courseSlug } = await params;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUserId = await getAppUserId(session.user.id);
    if (!appUserId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get course
    const [course] = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, course.id),
          eq(enrollments.appUserId, appUserId)
        )
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
    }

    // Get all progress for this user's lessons in this course
    // Join with lessons to filter by course
    const progressRecords = await db
      .select({
        lessonId: lessonProgress.lessonId,
        completed: lessonProgress.completed,
        watchedSeconds: lessonProgress.watchedSeconds,
        lastWatchedAt: lessonProgress.lastWatchedAt,
        completedAt: lessonProgress.completedAt,
      })
      .from(lessonProgress)
      .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
      .where(
        and(
          eq(lessonProgress.appUserId, appUserId),
          eq(lessons.courseId, course.id)
        )
      );

    return NextResponse.json({ progress: progressRecords });
  } catch (error) {
    console.error("❌ Get Progress Error:", error);
    return NextResponse.json(
      { error: "Failed to get progress" },
      { status: 500 }
    );
  }
}