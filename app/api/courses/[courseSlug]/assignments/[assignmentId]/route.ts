// app/api/courses/[courseSlug]/assignments/[assignmentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { assignments, courses, app_users, assignmentSubmissions } from "@/db/schema";
import { eq, and, count, desc, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Validation schema for updates
const updateAssignmentSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().min(10).optional(),
  instructions: z.string().optional().nullable(),
  maxScore: z.number().min(1).max(1000).optional(),
  dueDate: z.string().datetime().optional().nullable(),
  lessonId: z.string().uuid().optional().nullable(),
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

// GET - Fetch single assignment with submissions
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; assignmentId: string }> }
) {
  try {
    const { courseSlug, assignmentId } = await params;

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

    // Get assignment
    const [assignment] = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.courseId, course.id)
        )
      )
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Get submission statistics
    const [stats] = await db
      .select({
        totalSubmissions: count(),
        pendingCount: count(
          sql`CASE WHEN ${assignmentSubmissions.status} = 'pending' THEN 1 END`
        ),
        gradedCount: count(
          sql`CASE WHEN ${assignmentSubmissions.status} = 'graded' THEN 1 END`
        ),
        lateCount: count(
          sql`CASE WHEN ${assignmentSubmissions.status} = 'late' THEN 1 END`
        ),
        averageScore: sql<number>`AVG(${assignmentSubmissions.score})`,
        highestScore: sql<number>`MAX(${assignmentSubmissions.score})`,
        lowestScore: sql<number>`MIN(${assignmentSubmissions.score})`,
      })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignmentId));

    // Get recent submissions
    const recentSubmissions = await db
      .select({
        id: assignmentSubmissions.id,
        appUserId: assignmentSubmissions.appUserId,
        status: assignmentSubmissions.status,
        score: assignmentSubmissions.score,
        submittedAt: assignmentSubmissions.submittedAt,
        gradedAt: assignmentSubmissions.gradedAt,
        studentName: app_users.name,
        studentAvatar: app_users.avatar,
      })
      .from(assignmentSubmissions)
      .leftJoin(app_users, eq(assignmentSubmissions.appUserId, app_users.id))
      .where(eq(assignmentSubmissions.assignmentId, assignmentId))
      .orderBy(desc(assignmentSubmissions.submittedAt))
      .limit(10);

    return NextResponse.json({
      assignment: {
        ...assignment,
        isOverdue: assignment.dueDate
          ? new Date(assignment.dueDate) < new Date()
          : false,
        stats: {
          totalSubmissions: Number(stats?.totalSubmissions) || 0,
          pendingCount: Number(stats?.pendingCount) || 0,
          gradedCount: Number(stats?.gradedCount) || 0,
          lateCount: Number(stats?.lateCount) || 0,
          averageScore: stats?.averageScore
            ? Math.round(Number(stats.averageScore) * 100) / 100
            : null,
          highestScore: stats?.highestScore ? Number(stats.highestScore) : null,
          lowestScore: stats?.lowestScore ? Number(stats.lowestScore) : null,
        },
        recentSubmissions,
      },
    });
  } catch (error) {
    console.error("❌ GET Assignment Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch assignment" },
      { status: 500 }
    );
  }
}

// PATCH - Update assignment
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; assignmentId: string }> }
) {
  try {
    const { courseSlug, assignmentId } = await params;

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

    // Verify assignment exists
    const [existingAssignment] = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.courseId, course.id)
        )
      )
      .limit(1);

    if (!existingAssignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Parse and validate
    const body = await req.json();
    const validatedData = updateAssignmentSchema.parse(body);

    // Build update object
    const updateData: any = {
      updatedAt: new Date(),
    };

    if (validatedData.title !== undefined) updateData.title = validatedData.title;
    if (validatedData.description !== undefined) updateData.description = validatedData.description;
    if (validatedData.instructions !== undefined) updateData.instructions = validatedData.instructions;
    if (validatedData.maxScore !== undefined) updateData.maxScore = validatedData.maxScore;
    if (validatedData.dueDate !== undefined) {
      updateData.dueDate = validatedData.dueDate ? new Date(validatedData.dueDate) : null;
    }
    if (validatedData.lessonId !== undefined) updateData.lessonId = validatedData.lessonId;

    // Update assignment
    const [updatedAssignment] = await db
      .update(assignments)
      .set(updateData)
      .where(eq(assignments.id, assignmentId))
      .returning();

    return NextResponse.json({
      assignment: updatedAssignment,
    });
  } catch (error) {
    console.error("❌ PATCH Assignment Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update assignment" },
      { status: 500 }
    );
  }
}

// DELETE - Delete assignment
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; assignmentId: string }> }
) {
  try {
    const { courseSlug, assignmentId } = await params;

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

    // Verify assignment exists
    const [existingAssignment] = await db
      .select({ id: assignments.id })
      .from(assignments)
      .where(
        and(
          eq(assignments.id, assignmentId),
          eq(assignments.courseId, course.id)
        )
      )
      .limit(1);

    if (!existingAssignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Check if assignment has submissions
    const [submissionCount] = await db
      .select({ count: count() })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.assignmentId, assignmentId));

    if (submissionCount && Number(submissionCount.count) > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete assignment with student submissions",
          submissionCount: Number(submissionCount.count),
        },
        { status: 400 }
      );
    }

    // Delete assignment
    await db.delete(assignments).where(eq(assignments.id, assignmentId));

    return NextResponse.json({
      success: true,
      message: "Assignment deleted successfully",
    });
  } catch (error) {
    console.error("❌ DELETE Assignment Error:", error);
    return NextResponse.json(
      { error: "Failed to delete assignment" },
      { status: 500 }
    );
  }
}