// app/api/courses/[courseSlug]/sections/[sectionId]/quizzes/[quizId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { quizzes, quizQuestions, courses, app_users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const updateQuizSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().optional().nullable(),
  passingScore: z.number().min(0).max(100).optional(),
  timeLimit: z.number().min(0).optional().nullable(),
  maxAttempts: z.number().min(1).max(10).optional(),
  questions: z.array(z.object({
    id: z.string().uuid().optional(),
    question: z.string().min(5),
    questionType: z.enum(["multiple_choice", "true_false", "short_answer"]),
    options: z.array(z.string()),
    correctAnswer: z.union([z.string(), z.array(z.string())]),
    explanation: z.string().optional().nullable(), // ✅ Allow null and undefined
    points: z.number().min(1),
    order: z.number().min(0),
  })).optional(),
});

async function getInstructorId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

// GET - Get quiz with questions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; sectionId: string; quizId: string }> }
) {
  try {
    const { courseSlug, sectionId, quizId } = await params;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify ownership
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
      .where(and(eq(quizzes.id, quizId), eq(quizzes.sectionId, sectionId)))
      .limit(1);

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Get questions
    const questions = await db
      .select()
      .from(quizQuestions)
      .where(eq(quizQuestions.quizId, quizId))
      .orderBy(quizQuestions.order);

    return NextResponse.json({
      quiz: {
        ...quiz,
        questions,
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

// PATCH - Update quiz and questions
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; sectionId: string; quizId: string }> }
) {
  try {
    const { courseSlug, sectionId, quizId } = await params;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify ownership
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
      .where(and(eq(quizzes.id, quizId), eq(quizzes.sectionId, sectionId)))
      .limit(1);

    if (!existingQuiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Validate and update
    const body = await req.json();
    
    // Validate with better error handling
    let validatedData;
    try {
      validatedData = updateQuizSchema.parse(body);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error("❌ Validation error:", error.issues);
        return NextResponse.json(
          { 
            error: "Validation failed", 
            details: error.issues.map((e: z.ZodIssue) => ({
              path: e.path.join('.'),
              message: e.message,
            }))
          },
          { status: 400 }
        );
      }
      throw error;
    }

    // Update quiz basic info
    const updateData: any = { updatedAt: new Date() };
    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.passingScore !== undefined) updateData.passingScore = validatedData.passingScore;
    if (validatedData.timeLimit !== undefined) updateData.timeLimit = validatedData.timeLimit;
    if (validatedData.maxAttempts !== undefined) updateData.maxAttempts = validatedData.maxAttempts;

    const [updatedQuiz] = await db
      .update(quizzes)
      .set(updateData)
      .where(eq(quizzes.id, quizId))
      .returning();

    // Update questions if provided
    if (validatedData.questions) {
      // Get existing questions
      const existingQuestions = await db
        .select({ id: quizQuestions.id })
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, quizId));

      const existingIds = new Set(existingQuestions.map((q) => q.id));
      const providedIds = new Set(
        validatedData.questions.filter((q) => q.id).map((q) => q.id!)
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
          explanation: question.explanation || null, // ✅ Handle null/undefined
          points: question.points,
          order: question.order,
        };

        if (question.id && existingIds.has(question.id)) {
          // Update existing question
          await db
            .update(quizQuestions)
            .set(questionData)
            .where(eq(quizQuestions.id, question.id));
        } else {
          // Insert new question
          await db.insert(quizQuestions).values(questionData);
        }
      }
    }

    // Fetch updated quiz with questions
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

// DELETE - Delete quiz and all questions
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; sectionId: string; quizId: string }> }
) {
  try {
    const { courseSlug, sectionId, quizId } = await params;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Verify ownership
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
      .where(and(eq(quizzes.id, quizId), eq(quizzes.sectionId, sectionId)))
      .limit(1);

    if (!existingQuiz) {
      return NextResponse.json({ error: "Quiz not found" }, { status: 404 });
    }

    // Delete questions first (foreign key constraint)
    await db.delete(quizQuestions).where(eq(quizQuestions.quizId, quizId));

    // Delete quiz
    await db.delete(quizzes).where(eq(quizzes.id, quizId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ DELETE Quiz Error:", error);
    return NextResponse.json(
      { error: "Failed to delete quiz" },
      { status: 500 }
    );
  }
}