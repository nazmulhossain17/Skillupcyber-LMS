// ============================================
// FILE: app/instructor/assignments/page.tsx
// Instructor page to view/grade student submissions
// Uses: assignments table (not sections with type)
// ============================================

import { redirect } from 'next/navigation';
import { db } from '@/db/drizzle';
import { 
  courses, 
  assignments,
  app_users,
} from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { AssignmentSubmissionsClient } from '@/components/instructor/AssignmentSubmissionsClient';

async function getAppUser(userId: string) {
  const [user] = await db
    .select()
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user;
}

export default async function InstructorAssignmentsPage() {
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user?.id) {
    redirect('/auth/login?redirect=/instructor/assignments');
  }

  const appUser = await getAppUser(session.user.id);
  
  if (!appUser) {
    redirect('/auth/login');
  }

  // Check if user is instructor or admin
  if (appUser.role !== 'instructor' && appUser.role !== 'admin') {
    redirect('/dashboard');
  }

  // Get instructor's courses
  const instructorCourses = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      thumbnail: courses.thumbnail,
    })
    .from(courses)
    .where(eq(courses.instructorId, appUser.id))
    .orderBy(desc(courses.createdAt));

  // Get assignments for each course
  const coursesWithAssignments = await Promise.all(
    instructorCourses.map(async (course) => {
      const courseAssignments = await db
        .select({
          id: assignments.id,
          title: assignments.title,
          maxScore: assignments.maxScore,
        })
        .from(assignments)
        .where(eq(assignments.courseId, course.id))
        .orderBy(assignments.createdAt);

      return {
        ...course,
        assignments: courseAssignments,
        assignmentCount: courseAssignments.length,
      };
    })
  );

  // Filter to only courses with assignments
  const coursesWithAssignmentsOnly = coursesWithAssignments.filter(
    c => c.assignmentCount > 0
  );

  return (
    <AssignmentSubmissionsClient
      courses={coursesWithAssignmentsOnly}
      instructorId={appUser.id}
    />
  );
}