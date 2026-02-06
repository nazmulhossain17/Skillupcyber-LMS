// ============================================
// FILE: app/api/courses/[courseSlug]/assignments/[assignmentId]/submit/route.ts
// Student assignment submission API
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { 
  assignments, 
  assignmentSubmissions, 
  courses, 
  enrollments,
  app_users 
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Validation schema for submission
// Allows either content OR attachments (or both)
const submitAssignmentSchema = z.object({
  content: z.string().optional().default(''),
  attachments: z.array(z.object({
    url: z.string().url(),
    fileName: z.string(),
    fileSize: z.number().optional(),
    fileType: z.string().optional(),
    key: z.string().optional(),
  })).optional().nullable(),
}).refine(
  (data) => (data.content && data.content.trim().length > 0) || (data.attachments && data.attachments.length > 0),
  { message: "Please provide content or upload at least one file" }
);

// Helper: Get app_user ID from userId
async function getAppUserId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

// GET - Get user's submission for an assignment
export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      courseSlug: string;
      assignmentId: string;
    }>;
  }
) {
  try {
    const { courseSlug, assignmentId } = await params;

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

    // Check enrollment (must be active)
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, course.id),
          eq(enrollments.appUserId, appUserId),
          eq(enrollments.status, 'active')
        )
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
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

    // Get user's submission
    const [submission] = await db
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, assignmentId),
          eq(assignmentSubmissions.appUserId, appUserId)
        )
      )
      .limit(1);

    // Check if submission was late
    const isLate = assignment.dueDate && submission?.submittedAt 
      ? new Date(submission.submittedAt) > new Date(assignment.dueDate)
      : false;

    // Check if currently past due (for new submissions)
    const isPastDue = assignment.dueDate 
      ? new Date() > new Date(assignment.dueDate)
      : false;

    return NextResponse.json({
      success: true,
      assignment: {
        id: assignment.id,
        title: assignment.title,
        description: assignment.description,
        instructions: assignment.instructions,
        maxScore: assignment.maxScore,
        dueDate: assignment.dueDate?.toISOString() || null,
        isPastDue,
      },
      submission: submission ? {
        id: submission.id,
        content: submission.content,
        attachments: submission.attachments,
        status: submission.status,
        score: submission.score,
        feedback: submission.feedback,
        submittedAt: submission.submittedAt?.toISOString() || null,
        gradedAt: submission.gradedAt?.toISOString() || null,
        isLate,
      } : null,
      canSubmit: !submission || submission.status === 'pending' || submission.status === 'submitted' || submission.status === 'late',
    });
  } catch (error) {
    console.error("❌ Get Submission Error:", error);
    return NextResponse.json(
      { error: "Failed to get submission" },
      { status: 500 }
    );
  }
}

// POST - Submit assignment
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      courseSlug: string;
      assignmentId: string;
    }>;
  }
) {
  try {
    const { courseSlug, assignmentId } = await params;

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

    // Check enrollment (must be active)
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, course.id),
          eq(enrollments.appUserId, appUserId),
          eq(enrollments.status, 'active')
        )
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json({ error: "Not enrolled in this course" }, { status: 403 });
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

    // Check if already graded
    const [existingSubmission] = await db
      .select()
      .from(assignmentSubmissions)
      .where(
        and(
          eq(assignmentSubmissions.assignmentId, assignmentId),
          eq(assignmentSubmissions.appUserId, appUserId)
        )
      )
      .limit(1);

    if (existingSubmission && existingSubmission.status === 'graded') {
      return NextResponse.json(
        { error: "Assignment already graded. Cannot resubmit." },
        { status: 400 }
      );
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = submitAssignmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Validation failed" },
        { status: 400 }
      );
    }

    const { content, attachments } = parsed.data;

    // Check if past due date
    const isLate = assignment.dueDate && new Date() > new Date(assignment.dueDate);
    const newStatus = isLate ? 'late' : 'submitted';

    let submission;

    if (existingSubmission) {
      // Update existing submission
      [submission] = await db
        .update(assignmentSubmissions)
        .set({
          content: content?.trim() || null,
          attachments: attachments || null,
          submittedAt: new Date(),
          status: newStatus,
          // Clear previous grading on resubmit
          score: null,
          feedback: null,
          gradedAt: null,
          gradedBy: null,
        })
        .where(eq(assignmentSubmissions.id, existingSubmission.id))
        .returning();
    } else {
      // Create new submission
      [submission] = await db
        .insert(assignmentSubmissions)
        .values({
          assignmentId,
          appUserId,
          content: content?.trim() || null,
          attachments: attachments || null,
          submittedAt: new Date(),
          status: newStatus,
        })
        .returning();
    }

    return NextResponse.json({
      success: true,
      message: isLate 
        ? "Assignment submitted (late)" 
        : "Assignment submitted successfully",
      submission: {
        id: submission.id,
        content: submission.content,
        attachments: submission.attachments,
        status: submission.status,
        submittedAt: submission.submittedAt?.toISOString(),
        isLate,
      },
      assignment: {
        title: assignment.title,
        maxScore: assignment.maxScore,
      },
      isResubmission: !!existingSubmission,
    });
  } catch (error) {
    console.error("❌ Submit Assignment Error:", error);
    return NextResponse.json(
      { error: "Failed to submit assignment" },
      { status: 500 }
    );
  }
}