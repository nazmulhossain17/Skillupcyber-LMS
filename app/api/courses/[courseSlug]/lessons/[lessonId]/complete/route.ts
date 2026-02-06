// ============================================
// FILE: app/api/courses/[courseSlug]/lessons/[lessonId]/complete/route.ts
// API to mark a lesson as complete
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { 
  app_users, 
  lessons, 
  lessonProgress, 
  enrollments,
  sections,
  courses 
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; lessonId: string }> }
) {
  try {
    const { courseSlug, lessonId } = await params;

    // Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    }

    // Get course by slug
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get lesson
    const [lesson] = await db
      .select({
        id: lessons.id,
        sectionId: lessons.sectionId,
      })
      .from(lessons)
      .innerJoin(sections, eq(lessons.sectionId, sections.id))
      .where(
        and(
          eq(lessons.id, lessonId),
          eq(sections.courseId, course.id)
        )
      )
      .limit(1);

    if (!lesson) {
      return NextResponse.json({ error: 'Lesson not found' }, { status: 404 });
    }

    // Check enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.appUserId, appUser.id),
          eq(enrollments.courseId, course.id),
          eq(enrollments.status, 'active')
        )
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json(
        { error: 'You must be enrolled in this course' },
        { status: 403 }
      );
    }

    // Check if already completed
    const [existingProgress] = await db
      .select()
      .from(lessonProgress)
      .where(
        and(
          eq(lessonProgress.lessonId, lessonId),
          eq(lessonProgress.appUserId, appUser.id)
        )
      )
      .limit(1);

    if (existingProgress?.completed) {
      // Already completed, just return current progress
      const progress = await calculateProgress(course.id, appUser.id);
      return NextResponse.json({
        success: true,
        message: 'Lesson already completed',
        alreadyCompleted: true,
        progress,
      });
    }

    // Mark lesson as complete
    if (existingProgress) {
      // Update existing record
      await db
        .update(lessonProgress)
        .set({
          completed: true,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(lessonProgress.lessonId, lessonId),
            eq(lessonProgress.appUserId, appUser.id)
          )
        );
    } else {
      // Create new record - using only columns that exist in your schema
      await db.insert(lessonProgress).values({
        lessonId,
        appUserId: appUser.id,
        completed: true,
        completedAt: new Date(),
      });
    }

    // Calculate new progress
    const progress = await calculateProgress(course.id, appUser.id);

    // Update enrollment progress
    await db
      .update(enrollments)
      .set({
        progressPercent: progress.percentage,
        lastAccessedAt: new Date(),
        ...(progress.percentage === 100 ? { completedAt: new Date() } : {}),
      })
      .where(eq(enrollments.id, enrollment.id));

    return NextResponse.json({
      success: true,
      message: 'Lesson marked as complete',
      progress,
    });

  } catch (error: any) {
    console.error('Mark lesson complete error:', error);
    return NextResponse.json(
      { error: 'Failed to mark lesson complete', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to calculate course progress
async function calculateProgress(courseId: string, appUserId: string) {
  // Get total lessons in course
  const totalLessonsResult = await db
    .select({ count: sql<number>`COUNT(*)::integer` })
    .from(lessons)
    .innerJoin(sections, eq(lessons.sectionId, sections.id))
    .where(eq(sections.courseId, courseId));

  const totalLessons = totalLessonsResult[0]?.count || 0;

  // Get completed lessons
  const completedLessonsResult = await db
    .select({ count: sql<number>`COUNT(*)::integer` })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .innerJoin(sections, eq(lessons.sectionId, sections.id))
    .where(
      and(
        eq(sections.courseId, courseId),
        eq(lessonProgress.appUserId, appUserId),
        eq(lessonProgress.completed, true)
      )
    );

  const completedLessons = completedLessonsResult[0]?.count || 0;

  const percentage = totalLessons > 0 
    ? Math.round((completedLessons / totalLessons) * 100) 
    : 0;

  return {
    completed: completedLessons,
    total: totalLessons,
    percentage,
    isComplete: percentage === 100,
  };
}