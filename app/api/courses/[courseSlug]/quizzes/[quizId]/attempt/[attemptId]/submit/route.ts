// ============================================
// FILE: app/api/courses/[courseSlug]/quizzes/[quizId]/attempt/[attemptId]/submit/route.ts
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { 
  quizzes, 
  quizQuestions,
  quizAttempts,
  courses, 
  app_users 
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Validation schema
const submitQuizSchema = z.object({
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
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

// POST - Submit quiz attempt
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      courseSlug: string;
      quizId: string;
      attemptId: string;
    }>;
  }
) {
  try {
    const { courseSlug, quizId, attemptId } = await params;

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

    // Get attempt
    const [attempt] = await db
      .select()
      .from(quizAttempts)
      .where(
        and(
          eq(quizAttempts.id, attemptId),
          eq(quizAttempts.quizId, quizId),
          eq(quizAttempts.appUserId, appUserId)
        )
      )
      .limit(1);

    if (!attempt) {
      return NextResponse.json({ error: "Attempt not found" }, { status: 404 });
    }

    if (attempt.status === 'completed') {
      return NextResponse.json(
        { error: "This attempt has already been submitted" },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const validatedData = submitQuizSchema.parse(body);

    // Get all questions
    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId));

    // Calculate score
    let score = 0;
    let totalPoints = 0;
    const results: Record<string, { 
      correct: boolean; 
      userAnswer: string | string[]; 
      correctAnswer: string | string[];
      points: number;
    }> = {};

    for (const question of questions) {
      totalPoints += question.points;
      const userAnswer = validatedData.answers[question.id];
      
      // Cast correctAnswer to proper type (it's stored as jsonb which returns unknown)
      const correctAnswer = question.correctAnswer as string | string[];

      let isCorrect = false;

      if (Array.isArray(correctAnswer)) {
        // Multiple correct answers
        if (Array.isArray(userAnswer)) {
          isCorrect = correctAnswer.length === userAnswer.length &&
            correctAnswer.every((a) => userAnswer.includes(a));
        } else {
          isCorrect = correctAnswer.length === 1 && correctAnswer[0] === userAnswer;
        }
      } else {
        // Single correct answer
        isCorrect = userAnswer === correctAnswer;
      }

      if (isCorrect) {
        score += question.points;
      }

      results[question.id] = {
        correct: isCorrect,
        userAnswer: userAnswer || '',
        correctAnswer: correctAnswer,
        points: isCorrect ? question.points : 0,
      };
    }

    // Calculate percentage and pass status
    const percentage = totalPoints > 0 ? Math.round((score / totalPoints) * 100) : 0;
    const passed = percentage >= quiz.passingScore;

    // Update attempt
    const [updatedAttempt] = await db
      .update(quizAttempts)
      .set({
        score,
        totalPoints,
        passed,
        answers: validatedData.answers,
        status: 'completed',
        completedAt: new Date(),
      })
      .where(eq(quizAttempts.id, attemptId))
      .returning();

    return NextResponse.json({
      attempt: updatedAttempt,
      results,
      percentage,
      passed,
      message: passed 
        ? `Congratulations! You passed with ${percentage}%!` 
        : `You scored ${percentage}%. You need ${quiz.passingScore}% to pass.`,
    });
  } catch (error) {
    console.error("❌ Submit Quiz Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to submit quiz" },
      { status: 500 }
    );
  }
}