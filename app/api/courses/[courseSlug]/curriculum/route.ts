// app/api/courses/[courseSlug]/curriculum/route.ts
// Public API - Shows course structure with free/locked status
// Used for course detail page before enrollment

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { 
  courses, 
  sections, 
  lessons, 
  lessonContent,
  enrollments,
  app_users,
  quizzes,
  assignments,
} from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug } = params;

    // 1. Get course
    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        instructorId: courses.instructorId,
        published: courses.published,
        durationHours: courses.durationHours,
      })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 2. Check if user is authenticated and enrolled
    let isEnrolled = false;
    let isOwner = false;
    let isAdmin = false;
    let appUser = null;

    const session = await auth.api.getSession({ headers: req.headers });
    
    if (session?.user?.id) {
      const [user] = await db
        .select()
        .from(app_users)
        .where(eq(app_users.userId, session.user.id))
        .limit(1);

      if (user) {
        appUser = user;
        isOwner = course.instructorId === user.id;
        isAdmin = user.role === 'admin';

        if (!isOwner && !isAdmin) {
          const [enrollment] = await db
            .select()
            .from(enrollments)
            .where(and(
              eq(enrollments.appUserId, user.id),
              eq(enrollments.courseId, course.id),
              eq(enrollments.status, 'active')
            ))
            .limit(1);

          isEnrolled = !!enrollment;
        }
      }
    }

    const hasFullAccess = isEnrolled || isOwner || isAdmin;

    // 3. Get all sections
    const allSections = await db
      .select()
      .from(sections)
      .where(eq(sections.courseId, course.id))
      .orderBy(asc(sections.order));

    // 4. Build curriculum structure
    const curriculum = await Promise.all(
      allSections.map(async (section) => {
        let items: any[] = [];
        let totalDuration = 0;
        let freeItemsCount = 0;

        if (section.type === 'lessons') {
          // Get lessons for this section
          const sectionLessons = await db
            .select({
              id: lessons.id,
              title: lessons.title,
              slug: lessons.slug,
              order: lessons.order,
              durationMinutes: lessonContent.durationMinutes,
              isFree: lessonContent.isFree,
              hasVideo: lessonContent.videoUrl,
            })
            .from(lessons)
            .leftJoin(lessonContent, eq(lessons.id, lessonContent.lessonId))
            .where(eq(lessons.sectionId, section.id))
            .orderBy(asc(lessons.order));

          items = sectionLessons.map(lesson => {
            const isFree = lesson.isFree === true;
            const duration = lesson.durationMinutes || 0;
            totalDuration += duration;
            if (isFree) freeItemsCount++;

            return {
              id: lesson.id,
              type: 'lesson',
              title: lesson.title,
              slug: lesson.slug,
              order: lesson.order,
              durationMinutes: duration,
              isFree: isFree,
              hasVideo: !!lesson.hasVideo,
              locked: !hasFullAccess && !isFree,
            };
          });

        } else if (section.type === 'quiz') {
          // Get quiz for this section
          const [quiz] = await db
            .select({
              id: quizzes.id,
              title: quizzes.title,
              questionCount: quizzes.questionCount,
              timeLimit: quizzes.timeLimit,
              passingScore: quizzes.passingScore,
            })
            .from(quizzes)
            .where(eq(quizzes.sectionId, section.id))
            .limit(1);

          if (quiz) {
            items = [{
              id: quiz.id,
              type: 'quiz',
              title: quiz.title,
              questionCount: quiz.questionCount,
              timeLimit: quiz.timeLimit,
              passingScore: quiz.passingScore,
              locked: !hasFullAccess,
            }];
          }

        } else if (section.type === 'assignment') {
          // Get assignment for this section
          const [assignment] = await db
            .select({
              id: assignments.id,
              title: assignments.title,
              maxScore: assignments.maxScore,
              dueDate: assignments.dueDate,
            })
            .from(assignments)
            .where(eq(assignments.sectionId, section.id))
            .limit(1);

          if (assignment) {
            items = [{
              id: assignment.id,
              type: 'assignment',
              title: assignment.title,
              maxScore: assignment.maxScore,
              dueDate: assignment.dueDate,
              locked: !hasFullAccess,
            }];
          }
        }

        return {
          id: section.id,
          title: section.title,
          description: section.description,
          type: section.type,
          order: section.order,
          itemCount: items.length,
          totalDuration: totalDuration,
          freeItemsCount: freeItemsCount,
          items: items,
        };
      })
    );

    // 5. Calculate totals
    const totalLessons = curriculum.reduce((acc, s) => 
      acc + s.items.filter(i => i.type === 'lesson').length, 0
    );
    const totalQuizzes = curriculum.reduce((acc, s) => 
      acc + s.items.filter(i => i.type === 'quiz').length, 0
    );
    const totalAssignments = curriculum.reduce((acc, s) => 
      acc + s.items.filter(i => i.type === 'assignment').length, 0
    );
    const totalDuration = curriculum.reduce((acc, s) => acc + s.totalDuration, 0);
    const freeLessons = curriculum.reduce((acc, s) => acc + s.freeItemsCount, 0);

    return NextResponse.json({
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        durationHours: course.durationHours,
      },
      curriculum: curriculum,
      stats: {
        totalSections: curriculum.length,
        totalLessons: totalLessons,
        totalQuizzes: totalQuizzes,
        totalAssignments: totalAssignments,
        totalDurationMinutes: totalDuration,
        freeLessons: freeLessons,
      },
      access: {
        isAuthenticated: !!appUser,
        isEnrolled: isEnrolled,
        isOwner: isOwner,
        isAdmin: isAdmin,
        hasFullAccess: hasFullAccess,
      }
    });

  } catch (error) {
    console.error("Curriculum API Error:", error);
    return NextResponse.json(
      { error: "Failed to load curriculum" },
      { status: 500 }
    );
  }
}