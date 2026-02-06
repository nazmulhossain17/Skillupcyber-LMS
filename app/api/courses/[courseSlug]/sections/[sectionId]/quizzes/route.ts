// app/api/courses/[courseSlug]/sections/[sectionId]/quizzes/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { quizzes, courses, sections, app_users, enrollments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Validation schema
const createQuizSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  description: z.string().optional(),
  passingScore: z.number().min(0).max(100).default(70),
  timeLimit: z.number().min(1).optional().nullable(),
  maxAttempts: z.number().min(1).default(3),
});

async function getAppUserId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id ?? null;
}

// Helper: Get instructor UUID
async function getInstructorId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

// GET - Get quiz for a section

// Helper: Check if user is enrolled or owns course
async function checkAccess(courseId: string, appUserId: string, instructorId: string) {
  if (instructorId === appUserId) {
    return { hasAccess: true, isOwner: true };
  }

  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        eq(enrollments.appUserId, appUserId)
      )
    )
    .limit(1);

  return { 
    hasAccess: !!enrollment, 
    isOwner: false 
  };
}

// ---------------------------------------------------------
// GET – Get Quizzes for Section (Enrolled Students)
// ---------------------------------------------------------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; sectionId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, sectionId } = params;

    console.log('📝 Fetching quizzes for section:', sectionId);

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

    // Verify section exists and get course
    const [section] = await db
      .select({
        id: sections.id,
        courseId: sections.courseId,
      })
      .from(sections)
      .where(eq(sections.id, sectionId))
      .limit(1);

    if (!section) {
      return NextResponse.json(
        { error: "Section not found" },
        { status: 404 }
      );
    }

    // Get course info
    const [course] = await db
      .select({
        id: courses.id,
        instructorId: courses.instructorId,
      })
      .from(courses)
      .where(eq(courses.id, section.courseId))
      .limit(1);

    if (!course) {
      return NextResponse.json(
        { error: "Course not found" },
        { status: 404 }
      );
    }

    // Check access
    const { hasAccess } = await checkAccess(
      course.id,
      appUserId,
      course.instructorId
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Access denied - Not enrolled" },
        { status: 403 }
      );
    }

    // Get quizzes for section
    const sectionQuizzes = await db
      .select({
        id: quizzes.id,
        title: quizzes.title,
        description: quizzes.description,
        passingScore: quizzes.passingScore,
        timeLimit: quizzes.timeLimit,
        maxAttempts: quizzes.maxAttempts,
        questionCount: quizzes.questionCount,
        sectionId: quizzes.sectionId,
        courseId: quizzes.courseId,
        createdAt: quizzes.createdAt,
        updatedAt: quizzes.updatedAt,
      })
      .from(quizzes)
      .where(eq(quizzes.sectionId, sectionId));

    console.log(`✅ Retrieved ${sectionQuizzes.length} quizzes`);

    return NextResponse.json({
      quizzes: sectionQuizzes,
    });

  } catch (error) {
    console.error("❌ GET Quizzes Error:", error);
    return NextResponse.json(
      { error: "Failed to load quizzes" },
      { status: 500 }
    );
  }
}

// POST - Create quiz for a section
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; sectionId: string }> }
) {
  try {
    const { courseSlug, sectionId } = await params;

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

    // Verify section belongs to course and is of type 'quiz'
    const [section] = await db
      .select({ id: sections.id, type: sections.type })
      .from(sections)
      .where(
        and(
          eq(sections.id, sectionId),
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
      .where(eq(quizzes.sectionId, sectionId))
      .limit(1);

    if (existingQuiz) {
      return NextResponse.json(
        { error: "A quiz already exists for this section" },
        { status: 400 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = createQuizSchema.parse(body);

    // Create quiz
    const [newQuiz] = await db
      .insert(quizzes)
      .values({
        title: validatedData.title,
        description: validatedData.description || null,
        passingScore: validatedData.passingScore,
        timeLimit: validatedData.timeLimit || null,
        maxAttempts: validatedData.maxAttempts,
        sectionId: sectionId, // ✅ Required - 1-to-1 with section
        courseId: course.id,
        questionCount: 0, // Will be updated as questions are added
      })
      .returning();

    return NextResponse.json(
      { quiz: newQuiz },
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