// ============================================
// FILE: app/api/instructor/assignments/submissions/route.ts
// API to fetch student assignment submissions for instructor
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
import { eq, and, desc, sql, or, inArray } from "drizzle-orm";

export async function GET(req: NextRequest) {
  try {
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

    // Parse query params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "20"), 50);
    const courseId = searchParams.get("courseId");
    const assignmentId = searchParams.get("assignmentId");
    const status = searchParams.get("status");
    const search = searchParams.get("search");

    const offset = (page - 1) * limit;

    // Get instructor's course IDs
    const instructorCourses = await db
      .select({ id: courses.id })
      .from(courses)
      .where(eq(courses.instructorId, appUser.id));

    const courseIds = instructorCourses.map(c => c.id);

    if (courseIds.length === 0) {
      return NextResponse.json({
        success: true,
        submissions: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        stats: { total: 0, pending: 0, graded: 0, avgGrade: 0 },
      });
    }

    // Get assignment IDs for instructor's courses
    let assignmentIds: string[] = [];
    
    if (assignmentId && assignmentId !== 'all') {
      // Specific assignment - verify it belongs to instructor
      const [assignment] = await db
        .select({ id: assignments.id, courseId: assignments.courseId })
        .from(assignments)
        .where(eq(assignments.id, assignmentId))
        .limit(1);
      
      if (assignment && courseIds.includes(assignment.courseId)) {
        assignmentIds = [assignmentId];
      }
    } else if (courseId && courseId !== 'all') {
      // All assignments in specific course
      const courseAssignments = await db
        .select({ id: assignments.id })
        .from(assignments)
        .where(eq(assignments.courseId, courseId));
      assignmentIds = courseAssignments.map(a => a.id);
    } else {
      // All assignments in all instructor's courses
      const allAssignments = await db
        .select({ id: assignments.id })
        .from(assignments)
        .where(inArray(assignments.courseId, courseIds));
      assignmentIds = allAssignments.map(a => a.id);
    }

    if (assignmentIds.length === 0) {
      return NextResponse.json({
        success: true,
        submissions: [],
        pagination: { page, limit, total: 0, totalPages: 0 },
        stats: { total: 0, pending: 0, graded: 0, avgGrade: 0 },
      });
    }

    // Build conditions
    const conditions = [
      inArray(assignmentSubmissions.assignmentId, assignmentIds),
    ];

    // Cast status to enum type
    type AssignmentStatus = 'pending' | 'submitted' | 'graded' | 'late';
    const validStatuses: AssignmentStatus[] = ['pending', 'submitted', 'graded', 'late'];
    
    if (status && status !== 'all' && validStatuses.includes(status as AssignmentStatus)) {
      conditions.push(eq(assignmentSubmissions.status, status as AssignmentStatus));
    }

    // Build query with search
    let filteredSubmissions;
    if (search) {
      const searchLower = `%${search.toLowerCase()}%`;
      filteredSubmissions = await db
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
          maxScore: assignments.maxScore,
          courseId: assignments.courseId,
        })
        .from(assignmentSubmissions)
        .innerJoin(app_users, eq(assignmentSubmissions.appUserId, app_users.id))
        .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
        .where(
          and(
            ...conditions,
            or(
              sql`LOWER(${app_users.name}) LIKE ${searchLower}`,
              sql`LOWER(${app_users.email}) LIKE ${searchLower}`
            )
          )
        )
        .orderBy(desc(assignmentSubmissions.submittedAt))
        .limit(limit)
        .offset(offset);
    } else {
      filteredSubmissions = await db
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
          maxScore: assignments.maxScore,
          courseId: assignments.courseId,
        })
        .from(assignmentSubmissions)
        .innerJoin(app_users, eq(assignmentSubmissions.appUserId, app_users.id))
        .innerJoin(assignments, eq(assignmentSubmissions.assignmentId, assignments.id))
        .where(and(...conditions))
        .orderBy(desc(assignmentSubmissions.submittedAt))
        .limit(limit)
        .offset(offset);
    }

    // Get course titles
    const courseIdsInSubmissions = [...new Set(filteredSubmissions.map(s => s.courseId))];
    const courseTitles = courseIdsInSubmissions.length > 0
      ? await db
          .select({ id: courses.id, title: courses.title, slug: courses.slug })
          .from(courses)
          .where(inArray(courses.id, courseIdsInSubmissions))
      : [];

    const courseTitleMap = Object.fromEntries(
      courseTitles.map(c => [c.id, { title: c.title, slug: c.slug }])
    );

    // Format submissions (map score -> grade for frontend consistency)
    const formattedSubmissions = filteredSubmissions.map(sub => ({
      id: sub.id,
      assignmentId: sub.assignmentId,
      assignmentTitle: sub.assignmentTitle,
      studentId: sub.studentId,
      studentName: sub.studentName || 'Unknown',
      studentEmail: sub.studentEmail || '',
      studentAvatar: sub.studentAvatar,
      content: sub.content,
      attachments: sub.attachments,
      submittedAt: sub.submittedAt?.toISOString() || new Date().toISOString(),
      status: sub.status || 'pending',
      grade: sub.score, // Map score -> grade for frontend
      maxGrade: sub.maxScore || 100,
      feedback: sub.feedback,
      gradedAt: sub.gradedAt?.toISOString() || null,
      courseTitle: courseTitleMap[sub.courseId]?.title || 'Unknown Course',
      courseSlug: courseTitleMap[sub.courseId]?.slug || '',
    }));

    // Get total count
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)::integer` })
      .from(assignmentSubmissions)
      .where(inArray(assignmentSubmissions.assignmentId, assignmentIds));

    const total = countResult[0]?.count || 0;
    const totalPages = Math.ceil(total / limit);

    // Get stats
    const statsResult = await db
      .select({
        total: sql<number>`COUNT(*)::integer`,
        pending: sql<number>`SUM(CASE WHEN ${assignmentSubmissions.status} IN ('submitted', 'pending') THEN 1 ELSE 0 END)::integer`,
        graded: sql<number>`SUM(CASE WHEN ${assignmentSubmissions.status} = 'graded' THEN 1 ELSE 0 END)::integer`,
        avgGrade: sql<number>`AVG(CASE WHEN ${assignmentSubmissions.score} IS NOT NULL THEN ${assignmentSubmissions.score}::numeric END)`,
      })
      .from(assignmentSubmissions)
      .where(inArray(assignmentSubmissions.assignmentId, assignmentIds));

    const stats = {
      total: statsResult[0]?.total || 0,
      pending: statsResult[0]?.pending || 0,
      graded: statsResult[0]?.graded || 0,
      avgGrade: statsResult[0]?.avgGrade || 0,
    };

    return NextResponse.json({
      success: true,
      submissions: formattedSubmissions,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      stats,
    });

  } catch (error: any) {
    console.error("Fetch submissions error:", error);
    return NextResponse.json(
      { error: "Failed to fetch submissions", details: error.message },
      { status: 500 }
    );
  }
}