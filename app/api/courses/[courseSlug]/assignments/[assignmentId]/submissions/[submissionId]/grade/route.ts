// app/api/courses/[courseSlug]/assignments/[assignmentId]/submissions/[submissionId]/grade/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { assignments, assignmentSubmissions, courses, app_users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Validation schema for grading
const gradeSubmissionSchema = z.object({
  score: z.number().min(0, "Score must be at least 0"),
  feedback: z.string().optional(),
  status: z.enum(["graded", "pending"]).default("graded"),
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

// POST - Grade a submission
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      courseSlug: string;
      assignmentId: string;
      submissionId: string;
    }>;
  }
) {
  try {
    const { courseSlug, assignmentId, submissionId } = await params;

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

    // Get assignment and verify it belongs to course
    const [assignment] = await db
      .select({ id: assignments.id, maxScore: assignments.maxScore })
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

    // Get submission
    const [submission] = await db
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.id, submissionId),
          eq(assignmentSubmissions.assignmentId, assignmentId)
        )
      )
      .limit(1);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Parse and validate
    const body = await req.json();
    const validatedData = gradeSubmissionSchema.parse(body);

    // Validate score doesn't exceed max score
    if (validatedData.score > assignment.maxScore) {
      return NextResponse.json(
        {
          error: `Score cannot exceed maximum score of ${assignment.maxScore}`,
        },
        { status: 400 }
      );
    }

    // Update submission with grade
    const [gradedSubmission] = await db
      .update(assignmentSubmissions)
      .set({
        score: validatedData.score,
        feedback: validatedData.feedback || null,
        status: validatedData.status,
        gradedAt: new Date(),
        gradedBy: instructorId,
      })
      .where(eq(assignmentSubmissions.id, submissionId))
      .returning();

    // Get student info for response
    const [student] = await db
      .select({
        name: app_users.name,
        email: app_users.userId,
      })
      .from(app_users)
      .where(eq(app_users.id, submission.appUserId))
      .limit(1);

    return NextResponse.json({
      submission: {
        ...gradedSubmission,
        student,
        assignment: {
          id: assignment.id,
          maxScore: assignment.maxScore,
        },
        percentage: Math.round((validatedData.score / assignment.maxScore) * 100),
      },
    });
  } catch (error) {
    console.error("❌ Grade Submission Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to grade submission" },
      { status: 500 }
    );
  }
}