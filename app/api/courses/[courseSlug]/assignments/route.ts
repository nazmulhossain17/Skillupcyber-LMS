// app/api/courses/[courseSlug]/assignments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { assignments, courses, app_users, sections, assignmentSubmissions } from "@/db/schema";
import { eq, and, desc, count, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Validation schema - ✅ Updated to use sectionId
const createAssignmentSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  description: z.string().min(10, "Description must be at least 10 characters"),
  instructions: z.string().optional(),
  maxScore: z.number().min(1).max(1000).default(100),
  dueDate: z.string().datetime().optional().nullable(),
  sectionId: z.string().uuid(), // ✅ Changed from lessonId to sectionId (required)
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

// GET - List all assignments for a course
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

    // ✅ Fetch all assignments with section information
    const courseAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        instructions: assignments.instructions,
        maxScore: assignments.maxScore,
        dueDate: assignments.dueDate,
        sectionId: assignments.sectionId, // ✅ Changed from lessonId
        createdAt: assignments.createdAt,
        updatedAt: assignments.updatedAt,
        sectionTitle: sections.title, // ✅ Include section title
      })
      .from(assignments)
      .leftJoin(sections, eq(assignments.sectionId, sections.id))
      .where(eq(assignments.courseId, course.id))
      .orderBy(desc(assignments.createdAt));

    // Get submission statistics for each assignment
    const assignmentsWithStats = await Promise.all(
      courseAssignments.map(async (assignment) => {
        const [stats] = await db
          .select({
            totalSubmissions: count(),
            pendingCount: count(
              sql`CASE WHEN ${assignmentSubmissions.status} = 'pending' THEN 1 END`
            ),
            gradedCount: count(
              sql`CASE WHEN ${assignmentSubmissions.status} = 'graded' THEN 1 END`
            ),
            averageScore: sql<number>`AVG(${assignmentSubmissions.score})`,
          })
          .from(assignmentSubmissions)
          .where(eq(assignmentSubmissions.assignmentId, assignment.id));

        // Check if overdue
        const isOverdue = assignment.dueDate
          ? new Date(assignment.dueDate) < new Date()
          : false;

        return {
          ...assignment,
          isOverdue,
          stats: {
            totalSubmissions: Number(stats?.totalSubmissions) || 0,
            pendingCount: Number(stats?.pendingCount) || 0,
            gradedCount: Number(stats?.gradedCount) || 0,
            averageScore: stats?.averageScore
              ? Math.round(Number(stats.averageScore) * 100) / 100
              : null,
          },
        };
      })
    );

    return NextResponse.json(
      { assignments: assignmentsWithStats },
      {
        headers: {
          'Cache-Control': 'private, max-age=60',
        },
      }
    );
  } catch (error) {
    console.error("❌ GET Assignments Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

// POST - Create new assignment
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
    const validatedData = createAssignmentSchema.parse(body);

    // ✅ Verify section belongs to course and is of type 'assignment'
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

    // ✅ Verify section is of type 'assignment'
    if (section.type !== 'assignment') {
      return NextResponse.json(
        { error: "Section must be of type 'assignment'" },
        { status: 400 }
      );
    }

    // ✅ Check if assignment already exists for this section (1-to-1 relationship)
    const [existingAssignment] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(eq(assignments.sectionId, validatedData.sectionId))
      .limit(1);

    if (existingAssignment) {
      return NextResponse.json(
        { error: "An assignment already exists for this section" },
        { status: 400 }
      );
    }

    // Create assignment
    const [newAssignment] = await db
      .insert(assignments)
      .values({
        title: validatedData.title,
        description: validatedData.description,
        instructions: validatedData.instructions || null,
        maxScore: validatedData.maxScore,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        courseId: course.id,
        sectionId: validatedData.sectionId, // ✅ Changed from lessonId
      })
      .returning();

    return NextResponse.json(
      { assignment: newAssignment },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ POST Assignment Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create assignment" },
      { status: 500 }
    );
  }
}