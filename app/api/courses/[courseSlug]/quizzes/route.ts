// app/api/courses/[courseSlug]/quizzes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { quizzes, quizQuestions, courses, app_users, sections } from "@/db/schema";
import { eq, and, desc, count } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Validation schemas - ✅ Updated to use sectionId
const createQuizSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  description: z.string().optional(),
  passingScore: z.number().min(0).max(100).default(70),
  timeLimit: z.number().min(0).optional().nullable(),
  maxAttempts: z.number().min(1).max(10).default(3),
  sectionId: z.string().uuid(), // ✅ Changed from lessonId to sectionId (required)
  questions: z.array(z.object({
    question: z.string().min(5, "Question must be at least 5 characters"),
    questionType: z.enum(["multiple_choice", "true_false", "short_answer"]).default("multiple_choice"),
    options: z.array(z.string()).min(2, "At least 2 options required"),
    correctAnswer: z.union([z.string(), z.array(z.string())]),
    explanation: z.string().optional(),
    points: z.number().min(1).default(1),
    order: z.number().min(0),
  })).min(1, "At least one question is required"),
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

// GET - List all quizzes for a course
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

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.instructorId !== instructorId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // ✅ Fetch all quizzes with section information
    const courseQuizzes = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        description: quizzes.description,
        passingScore: quizzes.passingScore,
        timeLimit: quizzes.timeLimit,
        maxAttempts: quizzes.maxAttempts,
        sectionId: quizzes.sectionId, // ✅ Changed from lessonId
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
        sectionTitle: sections.title, // ✅ Include section title
      })
      .from(quizzes)
      .leftJoin(sections, eq(quizzes.sectionId, sections.id))
      .where(eq(quizzes.courseId, course.id))
      .orderBy(desc(quizzes.createdAt));

    // Get question counts for each quiz
    const quizzesWithCounts = await Promise.all(
      courseQuizzes.map(async (quiz) => {
        const questionCount = await db
          .select({ count: count() })
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, quiz.id));

        return {
          ...quiz,
          questionCount: Number(questionCount[0]?.count) || 0,
        };
      })
    );

    return NextResponse.json(
      { quizzes: quizzesWithCounts },
      { 
        headers: { 
          'Cache-Control': 'private, max-age=60' 
        } 
      }
    );
  } catch (error) {
    console.error("❌ GET Quizzes Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch quizzes" },
      { status: 500 }
    );
  }
}

// POST - Create new quiz
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

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.instructorId !== instructorId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createQuizSchema.parse(body);

    // ✅ Verify section belongs to course and is of type 'quiz'
    const [section] = await db
      .select({ id: sections.id, type: sections.type })
      .from(sections)
      .where(
        and(
          eq(sections.id, validatedData.sectionId),
          eq(sections.courseId, course.id)
        )
      )
      .limit(1);

    if (!section) {
      return NextResponse.json(
        { error: "Section not found in this course" },
        { status: 404 }
      );
    }

    // ✅ Verify section is of type 'quiz'
    if (section.type !== 'quiz') {
      return NextResponse.json(
        { error: "Section must be of type 'quiz'" },
        { status: 400 }
      );
    }

    // ✅ Check if quiz already exists for this section (1-to-1 relationship)
    const [existingQuiz] = await db
      .select({ id: quizzes.id })
      .from(quizzes)
      .where(eq(quizzes.sectionId, validatedData.sectionId))
      .limit(1);

    if (existingQuiz) {
      return NextResponse.json(
        { error: "A quiz already exists for this section" },
        { status: 400 }
      );
    }

    // Create quiz
    const [newQuiz] = await db
      .insert(quizzes)
      .values({
        title: validatedData.title,
        description: validatedData.description || null,
        passingScore: validatedData.passingScore,
        timeLimit: validatedData.timeLimit || null,
        maxAttempts: validatedData.maxAttempts,
        courseId: course.id,
        sectionId: validatedData.sectionId, // ✅ Changed from lessonId
        questionCount: validatedData.questions.length, // ✅ Set initial count
      })
      .returning();

    // Create questions
    const questionRecords = validatedData.questions.map((q) => ({
      quizId: newQuiz.id,
      question: q.question,
      questionType: q.questionType,
      options: q.options,
      correctAnswer: Array.isArray(q.correctAnswer) ? q.correctAnswer : [q.correctAnswer],
      explanation: q.explanation || null,
      points: q.points,
      order: q.order,
    }));

    const createdQuestions = await db
      .insert(quizQuestions)
      .values(questionRecords)
      .returning();

    return NextResponse.json(
      {
        quiz: {
          ...newQuiz,
          questions: createdQuestions,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ POST Quiz Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create quiz" },
      { status: 500 }
    );
  }
}