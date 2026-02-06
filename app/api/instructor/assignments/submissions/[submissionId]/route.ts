// ============================================
// FILE: app/api/instructor/assignments/submissions/[submissionId]/route.ts
// API to get submission details and grade it
// Schema: assignmentId, score, attachments (jsonb)
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { 
  assignmentSubmissions,
  assignments,
  courses,
  app_users,
} from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";

// GET - Get single submission details
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;

    // Auth check
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get submission with details
    const [submission] = await db
      .select({
        id: assignmentSubmissions.id,
        assignmentId: assignmentSubmissions.assignmentId,
        studentId: assignmentSubmissions.appUserId,
        content: assignmentSubmissions.content,
        attachments: assignmentSubmissions.attachments,
        submittedAt: assignmentSubmissions.submittedAt,
        status: assignmentSubmissions.status,
        score: assignmentSubmissions.score,
        feedback: assignmentSubmissions.feedback,
        gradedAt: assignmentSubmissions.gradedAt,
        studentName: app_users.name,
        studentEmail: app_users.email,
        studentAvatar: app_users.avatar,
        assignmentTitle: assignments.title,
        assignmentDescription: assignments.description,
        maxScore: assignments.maxScore,
        courseId: assignments.courseId,
      })
      .from(assignmentSubmissions)
      .innerJoin(app_users, eq(assignmentSubmissions.appUserId, app_users.id))
      .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
      .where(eq(assignmentSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Check if user is instructor of this course or the student
    const [course] = await db
      .select({ instructorId: courses.instructorId, title: courses.title, slug: courses.slug })
      .from(courses)
      .where(eq(courses.id, submission.courseId))
      .limit(1);

    const isInstructor = course?.instructorId === appUser.id;
    const isStudent = submission.studentId === appUser.id;
    const isAdmin = appUser.role === 'admin';

    if (!isInstructor && !isStudent && !isAdmin) {
      return NextResponse.json({ error: "Not authorized to view this submission" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      submission: {
        id: submission.id,
        assignmentId: submission.assignmentId,
        assignmentTitle: submission.assignmentTitle,
        assignmentDescription: submission.assignmentDescription,
        studentId: submission.studentId,
        studentName: submission.studentName,
        studentEmail: submission.studentEmail,
        studentAvatar: submission.studentAvatar,
        content: submission.content,
        attachments: submission.attachments,
        submittedAt: submission.submittedAt?.toISOString(),
        status: submission.status,
        grade: submission.score, // Map score -> grade for frontend
        maxGrade: submission.maxScore,
        feedback: submission.feedback,
        gradedAt: submission.gradedAt?.toISOString(),
        courseTitle: course?.title || 'Unknown',
        courseSlug: course?.slug || '',
      },
    });

  } catch (error: any) {
    console.error("Get submission error:", error);
    return NextResponse.json(
      { error: "Failed to fetch submission", details: error.message },
      { status: 500 }
    );
  }
}

// PATCH - Grade submission
const gradeSchema = z.object({
  grade: z.number().min(0),
  feedback: z.string().max(2000).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> }
) {
  try {
    const { submissionId } = await params;

    // Auth check
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Check if instructor or admin
    if (appUser.role !== 'instructor' && appUser.role !== 'admin') {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    // Parse and validate body
    const body = await req.json();
    const parsed = gradeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { grade, feedback } = parsed.data;

    // Get submission with assignment info
    const [submission] = await db
      .select({
        id: assignmentSubmissions.id,
        assignmentId: assignmentSubmissions.assignmentId,
      })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.id, submissionId))
      .limit(1);

    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    // Get assignment to verify course ownership and max score
    const [assignment] = await db
      .select({ 
        courseId: assignments.courseId,
        maxScore: assignments.maxScore,
      })
      .from(assignments)
      .where(eq(assignments.id, submission.assignmentId))
      .limit(1);

    if (!assignment) {
      return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
    }

    // Verify instructor owns this course
    const [course] = await db
      .select({ instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.id, assignment.courseId))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.instructorId !== appUser.id && appUser.role !== 'admin') {
      return NextResponse.json(
        { error: "You can only grade submissions for your own courses" },
        { status: 403 }
      );
    }

    // Validate grade against max score
    const maxScore = assignment.maxScore || 100;
    if (grade > maxScore) {
      return NextResponse.json(
        { error: `Grade cannot exceed maximum of ${maxScore}` },
        { status: 400 }
      );
    }

    // Update submission with grade (store as 'score' in DB)
    const [updatedSubmission] = await db
      .update(assignmentSubmissions)
      .set({
        score: grade, // Frontend sends 'grade', DB stores as 'score'
        feedback: feedback?.trim() || null,
        status: 'graded',
        gradedAt: new Date(),
        gradedBy: appUser.id,
      })
      .where(eq(assignmentSubmissions.id, submissionId))
      .returning();

    return NextResponse.json({
      success: true,
      message: "Submission graded successfully",
      submission: {
        id: updatedSubmission.id,
        grade: updatedSubmission.score, // Return as 'grade' for frontend
        feedback: updatedSubmission.feedback,
        status: updatedSubmission.status,
        gradedAt: updatedSubmission.gradedAt?.toISOString(),
      },
    });

  } catch (error: any) {
    console.error("Grade submission error:", error);
    return NextResponse.json(
      { error: "Failed to grade submission", details: error.message },
      { status: 500 }
    );
  }
}