// ============================================
// FILE: app/api/certificates/issue/route.ts
// API to issue certificates when students complete a course
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { 
  app_users, 
  courses, 
  enrollments,
  certificateTemplates,
  issuedCertificates,
  sections,
  lessons,
  lessonProgress,
} from '@/db/schema';
import { eq, and, count } from 'drizzle-orm';
import { nanoid } from 'nanoid';

// Generate unique credential ID
function generateCredentialId(): string {
  const year = new Date().getFullYear();
  const random = nanoid(8).toUpperCase();
  return `CERT-${year}-${random}`;
}

// POST - Issue certificate to student for completed course
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { courseId } = body;

    if (!courseId) {
      return NextResponse.json({ error: 'Course ID is required' }, { status: 400 });
    }

    // Get app_user (student)
    const [student] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!student) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.courseId, courseId),
          eq(enrollments.appUserId, student.id),
          eq(enrollments.status, 'active')
        )
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json(
        { error: 'You are not enrolled in this course' },
        { status: 403 }
      );
    }

    // Check if certificate already issued
    const [existingCert] = await db
      .select()
      .from(issuedCertificates)
      .where(
        and(
          eq(issuedCertificates.studentId, student.id),
          eq(issuedCertificates.courseId, courseId)
        )
      )
      .limit(1);

    if (existingCert && !existingCert.isRevoked) {
      return NextResponse.json({
        success: true,
        message: 'Certificate already issued',
        certificate: existingCert,
        alreadyIssued: true,
      });
    }

    // Get course with instructor
    const [course] = await db
      .select({
        id: courses.id,
        title: courses.title,
        instructorId: courses.instructorId,
      })
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: 'Course not found' }, { status: 404 });
    }

    // Get instructor name
    const [instructor] = await db
      .select({ name: app_users.name })
      .from(app_users)
      .where(eq(app_users.id, course.instructorId))
      .limit(1);

    // Check course completion
    // Get total lessons count
    const totalLessonsResult = await db
      .select({ count: count() })
      .from(lessons)
      .innerJoin(sections, eq(lessons.sectionId, sections.id))
      .where(eq(sections.courseId, courseId));

    const totalLessons = totalLessonsResult[0]?.count || 0;

    // Get completed lessons count - using 'completed' column (not 'isCompleted')
    const completedLessonsResult = await db
      .select({ count: count() })
      .from(lessonProgress)
      .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
      .innerJoin(sections, eq(lessons.sectionId, sections.id))
      .where(
        and(
          eq(sections.courseId, courseId),
          eq(lessonProgress.appUserId, student.id),
          eq(lessonProgress.completed, true)
        )
      );

    const completedLessons = completedLessonsResult[0]?.count || 0;

    // Calculate completion percentage
    const completionPercentage = totalLessons > 0 
      ? Math.round((completedLessons / totalLessons) * 100)
      : 0;

    // Require 100% completion (or adjust as needed)
    if (completionPercentage < 100) {
      return NextResponse.json(
        { 
          error: 'Course not completed',
          completionPercentage,
          totalLessons,
          completedLessons,
          message: `You have completed ${completionPercentage}% of the course. Complete all lessons to receive your certificate.`
        },
        { status: 400 }
      );
    }

    // Get certificate template
    const [template] = await db
      .select()
      .from(certificateTemplates)
      .where(
        and(
          eq(certificateTemplates.courseId, courseId),
          eq(certificateTemplates.isActive, true)
        )
      )
      .limit(1);

    if (!template) {
      return NextResponse.json(
        { error: 'No certificate template found for this course' },
        { status: 404 }
      );
    }

    // Calculate course hours from lessons (if available)
    // This is a simplified calculation - you may want to sum lesson durations
    let courseHours: number | null = null;
    
    // Try to calculate from lesson content durations if your schema supports it
    // For now, we'll leave it null and instructors can set it in the template

    // Issue certificate
    const [certificate] = await db
      .insert(issuedCertificates)
      .values({
        credentialId: generateCredentialId(),
        templateId: template.id,
        courseId: course.id,
        studentId: student.id,
        studentName: student.name || 'Student',
        courseName: course.title,
        instructorName: instructor?.name || null,
        courseHours,
        issuedAt: new Date(),
      })
      .returning();

    // Update enrollment to mark completed
    await db
      .update(enrollments)
      .set({ 
        completedAt: new Date(),
      })
      .where(eq(enrollments.id, enrollment.id));

    return NextResponse.json({
      success: true,
      message: 'Certificate issued successfully',
      certificate,
    }, { status: 201 });

  } catch (error: any) {
    console.error('Issue certificate error:', error);
    return NextResponse.json(
      { error: 'Failed to issue certificate' },
      { status: 500 }
    );
  }
}