// app/api/learn/courses/[courseSlug]/sections/[sectionId]/lessons/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { 
  lessons, 
  lessonContent, 
  sections, 
  courses, 
  enrollments,
  app_users 
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

// --------------------------
// Helper: Get app_user ID from userId
// --------------------------
async function getAppUserId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id, role: app_users.role })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user ?? null;
}

// --------------------------
// Helper: Check if user is enrolled or owns course
// --------------------------
async function checkAccess(courseId: string, appUserId: string, instructorId: string, role: string) {
  // Admin has full access
  if (role === 'admin') {
    return { hasAccess: true, isOwner: false, isAdmin: true, isEnrolled: false };
  }

  // Check if user is the course owner/instructor
  if (instructorId === appUserId) {
    return { hasAccess: true, isOwner: true, isAdmin: false, isEnrolled: false };
  }

  // Check if user is enrolled
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, courseId),
        eq(enrollments.appUserId, appUserId),
        eq(enrollments.status, 'active')
      )
    )
    .limit(1);

  return { 
    hasAccess: !!enrollment, 
    isOwner: false,
    isAdmin: false,
    isEnrolled: !!enrollment
  };
}

// ---------------------------------------------------------
// GET – Get Lessons for Section
// Supports: Enrolled Students, Instructors, Admins, Free Preview
// ---------------------------------------------------------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; sectionId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, sectionId } = params;

    console.log('📖 Learn API - Fetching lessons for:', courseSlug, sectionId);

    // 1. Verify course exists
    const [course] = await db
      .select({ 
        id: courses.id, 
        instructorId: courses.instructorId,
        published: courses.published,
        title: courses.title,
        slug: courses.slug,
      })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 2. Verify section belongs to course
    const [section] = await db
      .select({ 
        id: sections.id,
        type: sections.type,
        title: sections.title,
      })
      .from(sections)
      .where(
        and(
          eq(sections.id, sectionId), 
          eq(sections.courseId, course.id)
        )
      )
      .limit(1);

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // 3. If not a lessons section, return empty
    if (section.type !== 'lessons') {
      return NextResponse.json({ 
        lessons: [],
        sectionType: section.type 
      });
    }

    // 4. Try to get session (may be null for unauthenticated users)
    const session = await auth.api.getSession({ headers: req.headers });
    const appUser = session?.user?.id ? await getAppUserId(session.user.id) : null;

    // 5. Determine access level
    let hasFullAccess = false;
    let accessType: 'owner' | 'admin' | 'enrolled' | 'preview' | 'none' = 'none';

    if (appUser) {
      const { hasAccess, isOwner, isAdmin, isEnrolled } = await checkAccess(
        course.id, 
        appUser.id, 
        course.instructorId,
        appUser.role
      );

      hasFullAccess = hasAccess;
      
      if (isOwner) accessType = 'owner';
      else if (isAdmin) accessType = 'admin';
      else if (isEnrolled) accessType = 'enrolled';
      else accessType = 'preview';
    } else {
      accessType = 'preview';
    }

    console.log(`📊 Access type: ${accessType}, Full access: ${hasFullAccess}`);

    // 6. Fetch all lessons for the section
    const allLessons = await db
      .select({
        // Lesson basic info
        id: lessons.id,
        title: lessons.title,
        slug: lessons.slug,
        order: lessons.order,
        sectionId: lessons.sectionId,
        courseId: lessons.courseId,
        createdAt: lessons.createdAt,
        updatedAt: lessons.updatedAt,
        
        // Lesson content
        content: lessonContent.content,
        durationMinutes: lessonContent.durationMinutes,
        videoUrl: lessonContent.videoUrl,
        videoPlaybackId: lessonContent.videoPlaybackId,
        isFree: lessonContent.isFree,
        resources: lessonContent.resources,
      })
      .from(lessons)
      .leftJoin(lessonContent, eq(lessons.id, lessonContent.lessonId))
      .where(eq(lessons.sectionId, sectionId))
      .orderBy(lessons.order);

    // 7. Filter/modify based on access level
    let responseLessons;

    if (hasFullAccess) {
      // ✅ Full access - return all lessons with full content
      responseLessons = allLessons;
      console.log(`✅ Full access - returning ${allLessons.length} lessons`);
    } else {
      // 🔒 Limited access - only show free preview content
      responseLessons = allLessons.map(lesson => {
        const isFreePreview = lesson.isFree === true;

        if (isFreePreview) {
          // ✅ Free preview - return full content
          return {
            ...lesson,
            locked: false,
          };
        } else {
          // 🔒 Locked - return limited info only
          return {
            id: lesson.id,
            title: lesson.title,
            slug: lesson.slug,
            order: lesson.order,
            sectionId: lesson.sectionId,
            courseId: lesson.courseId,
            durationMinutes: lesson.durationMinutes,
            isFree: false,
            locked: true,
            // Don't expose content, video URL, or resources
            content: null,
            videoUrl: null,
            videoPlaybackId: null,
            resources: null,
          };
        }
      });

      const freeCount = responseLessons.filter(l => !l.locked).length;
      const lockedCount = responseLessons.filter(l => l.locked).length;
      console.log(`🔒 Preview access - ${freeCount} free, ${lockedCount} locked`);
    }

    return NextResponse.json({ 
      lessons: responseLessons,
      section: {
        id: section.id,
        title: section.title,
        type: section.type,
      },
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
      },
      access: {
        type: accessType,
        hasFullAccess: hasFullAccess,
        isAuthenticated: !!appUser,
      }
    });

  } catch (error) {
    console.error("❌ Learn Lessons API Error:", error);
    return NextResponse.json(
      { 
        error: "Failed to load lessons",
        message: error instanceof Error ? error.message : "Unknown error"
      }, 
      { status: 500 }
    );
  }
}