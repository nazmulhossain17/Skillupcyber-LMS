// ============================================
// FILE: app/api/courses/[courseSlug]/quizzes/[quizId]/questions/route.ts
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { 
  quizzes, 
  quizQuestions,
  quizAttempts,
  courses, 
  enrollments,
  app_users 
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
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

// GET - Get quiz questions (only for students with active attempt)
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

    // Check for active attempt
    const [activeAttempt] = await db
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

    if (!activeAttempt) {
      return NextResponse.json(
        { error: "No active quiz attempt. Please start the quiz first." },
        { status: 400 }
      );
    }

    // Get questions (without correct answers for active quiz)
    const questions = await db
      .select({
        id: quizQuestions.id,
        question: quizQuestions.question,
        questionType: quizQuestions.questionType,
        options: quizQuestions.options,
        points: quizQuestions.points,
        order: quizQuestions.order,
        // Don't include correctAnswer for active quiz
      })
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(asc(quizQuestions.order));

    return NextResponse.json({
      quiz: {
        id: quiz.id,
        title: quiz.title,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore,
      },
      questions,
      attemptId: activeAttempt.id,
    });
  } catch (error) {
    console.error("❌ Get Quiz Questions Error:", error);
    return NextResponse.json(
      { error: "Failed to get quiz questions" },
      { status: 500 }
    );
  }
}