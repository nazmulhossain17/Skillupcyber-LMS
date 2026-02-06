// ============================================
// FILE: app/api/courses/[courseSlug]/quizzes/[quizId]/attempt/route.ts
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { 
  quizzes, 
  quizAttempts,
  courses, 
  enrollments,
  app_users 
} from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { auth } from "@/lib/auth";

// Helper: Get app_user ID from userId
async function getAppUserId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

// GET - Get user's attempts for a quiz
export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      courseSlug: string;
      quizId: string;
    }>;
  }
) {
  try {
    const { courseSlug, quizId } = await params;

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

    // Get quiz
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.courseId, course.id)
        )
      )
      .limit(1);

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Get user's attempts
    const attempts = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.quizId, quizId),
          eq(quizAttempts.appUserId, appUserId)
        )
      )
      .orderBy(desc(quizAttempts.startedAt));

    const completedAttempts = attempts.filter(a => a.status === 'completed');
    const bestAttempt = completedAttempts.reduce((best, current) => {
      if (!best) return current;
      return (current.score || 0) > (best.score || 0) ? current : best;
    }, null as typeof attempts[0] | null);

    // Handle nullable maxAttempts (default to 3 if null)
    const maxAttempts = quiz.maxAttempts ?? 3;

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        maxAttempts: maxAttempts,
      },
      attempts,
      attemptsUsed: completedAttempts.length,
      attemptsRemaining: maxAttempts - completedAttempts.length,
      bestAttempt,
      canAttempt: completedAttempts.length < maxAttempts,
    });
  } catch (error) {
    console.error("❌ Get Quiz Attempts Error:", error);
    return NextResponse.json(
      { error: "Failed to get quiz attempts" },
      { status: 500 }
    );
  }
}

// POST - Start a new quiz attempt
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      courseSlug: string;
      quizId: string;
    }>;
  }
) {
  try {
    const { courseSlug, quizId } = await params;

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

    // Check enrollment
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

    // Get quiz
    const [quiz] = await db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.courseId, course.id)
        )
      )
      .limit(1);

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Handle nullable maxAttempts (default to 3 if null)
    const maxAttempts = quiz.maxAttempts ?? 3;

    // Check existing attempts
    const existingAttempts = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.quizId, quizId),
          eq(quizAttempts.appUserId, appUserId),
          eq(quizAttempts.status, 'completed')
        )
      );

    if (existingAttempts.length >= maxAttempts) {
      return NextResponse.json(
        { error: `Maximum attempts (${maxAttempts}) reached` },
        { status: 400 }
      );
    }

    // Check for in-progress attempt
    const [inProgressAttempt] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.quizId, quizId),
          eq(quizAttempts.appUserId, appUserId),
          eq(quizAttempts.status, 'in_progress')
        )
      )
      .limit(1);

    if (inProgressAttempt) {
      // Return existing in-progress attempt
      return NextResponse.json({
        attempt: inProgressAttempt,
        message: "Continuing existing attempt",
      });
    }

    // Create new attempt
    const [attempt] = await db
      .insert(quizAttempts)
      .values({
        quizId,
        appUserId,
        status: 'in_progress',
        startedAt: new Date(),
      })
      .returning();

    return NextResponse.json({
      attempt,
      message: "Quiz attempt started",
      attemptsRemaining: maxAttempts - existingAttempts.length - 1,
    });
  } catch (error) {
    console.error("❌ Start Quiz Attempt Error:", error);
    return NextResponse.json(
      { error: "Failed to start quiz attempt" },
      { status: 500 }
    );
  }
}