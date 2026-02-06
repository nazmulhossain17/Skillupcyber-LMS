// app/api/student/enrolled-courses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { 
  enrollments, 
  courses, 
  app_users,
  lessons,
  sections 
} from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { auth } from "@/lib/auth";

// Helper: Get app_user ID from userId
async function getAppUserId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id ?? null;
}

export async function GET(req: NextRequest) {
  try {
    console.log('📚 Fetching enrolled courses');

    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const appUserId = await getAppUserId(session.user.id);
    if (!appUserId) {
      return NextResponse.json(
        { error: "User profile not found" },
        { status: 404 }
      );
    }

    // Get all enrollments for this user
    const userEnrollments = await db
      .select({
        enrollmentId: enrollments.id,
        enrolledAt: enrollments.enrolledAt,
        lastAccessedAt: enrollments.lastAccessedAt,
        courseId: courses.id,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        courseThumbnail: courses.thumbnail,
        courseDescription: courses.description,
        instructorId: app_users.id,
        instructorName: app_users.name,
        instructorAvatar: app_users.avatar,
      })
      .from(enrollments)
      .innerJoin(courses, eq(enrollments.courseId, courses.id))
      .leftJoin(app_users, eq(courses.instructorId, app_users.id))
      .where(eq(enrollments.appUserId, appUserId))
      .orderBy(sql`${enrollments.lastAccessedAt} DESC NULLS LAST`);

    // For each course, calculate progress
    const coursesWithProgress = await Promise.all(
      userEnrollments.map(async (enrollment) => {
        // Get total lessons for this course
        const courseSections = await db
          .select({
            sectionId: sections.id,
          })
          .from(sections)
          .where(
            and(
              eq(sections.courseId, enrollment.courseId),
              eq(sections.type, 'lessons')
            )
          );

        const sectionIds = courseSections.map(s => s.sectionId);

        let totalLessons = 0;
        if (sectionIds.length > 0) {
          // Use inArray for better compatibility
          const lessonCount = await db
            .select({ count: sql<number>`count(*)::int` })
            .from(lessons)
            .where(sql`${lessons.sectionId} IN (${sql.join(sectionIds.map(id => sql`${id}`), sql`, `)})`);
          
          totalLessons = lessonCount[0]?.count || 0;
        }

        // Calculate completed lessons (placeholder - we'll track this later)
        const completedLessons = 0; // TODO: Add lesson_progress table
        const progress = totalLessons > 0 
          ? Math.round((completedLessons / totalLessons) * 100)
          : 0;

        return {
          id: enrollment.enrollmentId,
          title: enrollment.courseTitle,
          slug: enrollment.courseSlug,
          thumbnail: enrollment.courseThumbnail,
          description: enrollment.courseDescription,
          progress: progress,
          totalLessons: totalLessons,
          completedLessons: completedLessons,
          enrolledAt: enrollment.enrolledAt,
          lastAccessedAt: enrollment.lastAccessedAt || enrollment.enrolledAt,
          instructor: {
            id: enrollment.instructorId,
            name: enrollment.instructorName,
            avatar: enrollment.instructorAvatar,
          },
        };
      })
    );

    console.log(`✅ Retrieved ${coursesWithProgress.length} enrolled courses`);

    return NextResponse.json({
      courses: coursesWithProgress,
    });

  } catch (error) {
    console.error("❌ GET Enrolled Courses Error:", error);
    return NextResponse.json(
      { error: "Failed to load enrolled courses" },
      { status: 500 }
    );
  }
}