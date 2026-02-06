// app/api/courses/[courseSlug]/quizzes/[quizId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { quizzes, quizQuestions, courses, app_users, quizAttempts } from "@/db/schema";
import { eq, and, count, avg, sum, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Validation schema for updates
const updateQuizSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().optional().nullable(),
  passingScore: z.number().min(0).max(100).optional(),
  timeLimit: z.number().min(0).optional().nullable(),
  maxAttempts: z.number().min(1).max(10).optional(),
  lessonId: z.string().uuid().optional().nullable(),
  questions: z.array(z.object({
    id: z.string().uuid().optional(), // Existing question ID (for updates)
    question: z.string().min(5),
    questionType: z.enum(["multiple_choice", "true_false", "short_answer"]),
    options: z.array(z.string()).min(2),
    correctAnswer: z.union([z.string(), z.array(z.string())]),
    explanation: z.string().optional(),
    points: z.number().min(1),
    order: z.number().min(0),
  })).optional(),
});

// Helper: Get instructor UUID
async function getInstructorId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

// GET - Fetch single quiz with questions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; quizId: string }> }
) {
  try {
    const { courseSlug, quizId } = await params;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get course and verify ownership
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course || course.instructorId !== instructorId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
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

    // Get questions
    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quiz.id))
      .orderBy(quizQuestions.order);

    // Get attempt statistics
    const [attemptStats] = await db
      .select({
        totalAttempts: count(),
        averageScore: avg(quizAttempts.score),
        passedCount: sum(
          sql`CASE WHEN ${quizAttempts.passed} = true THEN 1 ELSE 0 END`
        ),
      })
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, quiz.id));

    return NextResponse.json({
      quiz: {
        ...quiz,
        questions,
        stats: {
          totalAttempts: Number(attemptStats?.totalAttempts) || 0,
          averageScore: attemptStats?.averageScore ? Number(attemptStats.averageScore) : 0,
          passRate: attemptStats?.passedCount ? Number(attemptStats.passedCount) : 0,
        },
      },
    });
  } catch (error) {
    console.error("❌ GET Quiz Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quiz" },
      { status: 500 }
    );
  }
}

// PATCH - Update quiz
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; quizId: string }> }
) {
  try {
    const { courseSlug, quizId } = await params;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get course and verify ownership
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course || course.instructorId !== instructorId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify quiz exists
    const [existingQuiz] = await db
      .select()
      .from(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.courseId, course.id)
        )
      )
      .limit(1);

    if (!existingQuiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Parse and validate
    const body = await req.json();
    const validatedData = updateQuizSchema.parse(body);

    // Build update object
    const updateData: any = { updatedAt: new Date() };
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.passingScore !== undefined) updateData.passingScore = validatedData.passingScore;
    if (validatedData.timeLimit !== undefined) updateData.timeLimit = validatedData.timeLimit;
    if (validatedData.maxAttempts !== undefined) updateData.maxAttempts = validatedData.maxAttempts;
    if (validatedData.lessonId !== undefined) updateData.lessonId = validatedData.lessonId;

    // Update quiz
    const [updatedQuiz] = await db
      .update(quizzes)
      .set(updateData)
      .where(eq(quizzes.id, quizId))
      .returning();

    // Update questions if provided
    if (validatedData.questions) {
      // Get existing question IDs
      const existingQuestions = await db
        .select({ id: quizQuestions.id })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quizId));

      const existingIds = new Set(existingQuestions.map((q) => q.id));
      const providedIds = new Set(
        validatedData.questions
          .filter((q) => q.id)
          .map((q) => q.id!)
      );

      // Delete removed questions
      const toDelete = existingQuestions
        .filter((q) => !providedIds.has(q.id))
        .map((q) => q.id);

      if (toDelete.length > 0) {
        for (const id of toDelete) {
          await db.delete(quizQuestions).where(eq(quizQuestions.id, id));
        }
      }

      // Update or insert questions
      for (const question of validatedData.questions) {
        const questionData = {
          quizId,
          question: question.question,
          questionType: question.questionType,
          options: question.options,
          correctAnswer: Array.isArray(question.correctAnswer)
            ? question.correctAnswer
            : [question.correctAnswer],
          explanation: question.explanation || null,
          points: question.points,
          order: question.order,
        };

        if (question.id && existingIds.has(question.id)) {
          // Update existing
          await db
            .update(quizQuestions)
            .set(questionData)
            .where(eq(quizQuestions.id, question.id));
        } else {
          // Insert new
          await db.insert(quizQuestions).values(questionData);
        }
      }
    }

    // Fetch updated questions
    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.order);

    return NextResponse.json({
      quiz: {
        ...updatedQuiz,
        questions,
      },
    });
  } catch (error) {
    console.error("❌ PATCH Quiz Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update quiz" },
      { status: 500 }
    );
  }
}

// DELETE - Delete quiz
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; quizId: string }> }
) {
  try {
    const { courseSlug, quizId } = await params;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get course and verify ownership
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course || course.instructorId !== instructorId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Verify quiz exists
    const [existingQuiz] = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(
        and(
          eq(quizzes.id, quizId),
          eq(quizzes.courseId, course.id)
        )
      )
      .limit(1);

    if (!existingQuiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Check if quiz has attempts
    const [attemptCount] = await db
      .select({ count: count() })
      .from(quizAttempts)
      .where(eq(quizAttempts.quizId, quizId));

    if (attemptCount && Number(attemptCount.count) > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete quiz with student attempts",
          attemptCount: Number(attemptCount.count),
        },
        { status: 400 }
      );
    }

    // Delete quiz (questions cascade automatically)
    await db.delete(quizzes).where(eq(quizzes.id, quizId));

    return NextResponse.json({
      success: true,
      message: "Quiz deleted successfully",
    });
  } catch (error) {
    console.error("❌ DELETE Quiz Error:", error);
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 }
    );
  }
}