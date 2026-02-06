// app/api/courses/[courseSlug]/sections/[sectionId]/assignments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { assignments, courses, sections, app_users, assignmentSubmissions } from "@/db/schema";
import { eq, and, count, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

const createAssignmentSchema = z.object({
  title: z.string().min(3).max(255),
  description: z.string().min(10),
  instructions: z.string().optional(),
  maxScore: z.number().min(1).max(1000).default(100),
  dueDate: z.string().datetime().optional().nullable(),
});

async function getInstructorId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

// GET - List assignments for a section
export async function GET(
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

    // Verify course and section
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    const [section] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.id, sectionId), eq(sections.courseId, course.id)))
      .limit(1);

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Fetch assignments for this section
    const sectionAssignments = await db
      .select({
        id: assignments.id,
        title: assignments.title,
        description: assignments.description,
        instructions: assignments.instructions,
        maxScore: assignments.maxScore,
        dueDate: assignments.dueDate,
        createdAt: assignments.createdAt,
        updatedAt: assignments.updatedAt,
      })
      .from(assignments)
      .where(eq(assignments.sectionId, sectionId));

    // Get submission statistics
    const assignmentsWithStats = await Promise.all(
      sectionAssignments.map(async (assignment) => {
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

    return NextResponse.json({ assignments: assignmentsWithStats });
  } catch (error) {
    console.error("❌ GET Section Assignments Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignments" },
      { status: 500 }
    );
  }
}

// POST - Create assignment for a section
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

    // Verify course and section
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course || course.instructorId !== instructorId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const [section] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.id, sectionId), eq(sections.courseId, course.id)))
      .limit(1);

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // Validate and create assignment
    const body = await req.json();
    const validatedData = createAssignmentSchema.parse(body);

    const [newAssignment] = await db
      .insert(assignments)
      .values({
        title: validatedData.title,
        description: validatedData.description,
        instructions: validatedData.instructions || null,
        maxScore: validatedData.maxScore,
        dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null,
        courseId: course.id,
        sectionId: sectionId,
      })
      .returning();

    return NextResponse.json({ assignment: newAssignment }, { status: 201 });
  } catch (error) {
    console.error("❌ POST Section Assignment Error:", error);

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