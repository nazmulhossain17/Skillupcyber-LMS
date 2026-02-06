// app/api/courses/[courseSlug]/lessons/[lessonId]/content/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { lessons, lessonContent, courses, app_users, enrollments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

// --------------------------
// Helper: Get app user (returns null if not found)
// --------------------------
async function getAppUser(userId: string) {
  const [user] = await db
    .select()
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);

  return user ?? null;
}

// --------------------------
// Helper: Check if user is enrolled in course
// --------------------------
async function isEnrolled(appUserId: string, courseId: string) {
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.appUserId, appUserId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.status, 'active')
      )
    )
    .limit(1);

  return !!enrollment;
}

// --------------------------
// Helper: Check if user is course instructor
// --------------------------
async function isInstructor(appUserId: string, courseId: string) {
  const [course] = await db
    .select({ instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.id, courseId))
    .limit(1);

  return course?.instructorId === appUserId;
}

// ---------------------------------------------------------
// GET – Get Lesson with Content
// Supports: Instructor, Enrolled Students, Free Preview
// ---------------------------------------------------------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; lessonId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, lessonId } = params;
    console.log("📖 GET Lesson Content - courseSlug:", courseSlug, "lessonId:", lessonId);

    // Get course by slug
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Get lesson
    const [lesson] = await db
      .select()
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, course.id)))
      .limit(1);

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Get lesson content
    const [content] = await db
      .select()
      .from(lessonContent)
      .where(eq(lessonContent.lessonId, lessonId))
      .limit(1);

    // ✅ Check if lesson is FREE PREVIEW
    const isFreePreview = content?.isFree === true;

    // Try to get session (may be null for unauthenticated users)
    const session = await auth.api.getSession({ headers: req.headers });
    const appUser = session?.user?.id ? await getAppUser(session.user.id) : null;

    // Determine access level
    let hasAccess = false;
    let accessType: 'instructor' | 'enrolled' | 'preview' | 'none' = 'none';

    if (appUser) {
      // Check if instructor
      if (await isInstructor(appUser.id, course.id)) {
        hasAccess = true;
        accessType = 'instructor';
      }
      // Check if admin
      else if (appUser.role === 'admin') {
        hasAccess = true;
        accessType = 'instructor';
      }
      // Check if enrolled
      else if (await isEnrolled(appUser.id, course.id)) {
        hasAccess = true;
        accessType = 'enrolled';
      }
      // Check if free preview
      else if (isFreePreview) {
        hasAccess = true;
        accessType = 'preview';
      }
    } else {
      // Unauthenticated user - only allow free preview
      if (isFreePreview) {
        hasAccess = true;
        accessType = 'preview';
      }
    }

    // ❌ No access
    if (!hasAccess) {
      return NextResponse.json(
        { 
          error: "Access denied",
          message: "You need to enroll in this course to access this lesson",
          isFree: isFreePreview,
          lesson: {
            id: lesson.id,
            title: lesson.title,
            slug: lesson.slug,
            order: lesson.order,
            // Don't include content for non-preview locked lessons
            content: null,
          }
        }, 
        { status: 403 }
      );
    }

    console.log(`✅ Access granted: ${accessType}`);

    // ✅ Return full lesson with content
    return NextResponse.json({
      lesson: {
        ...lesson,
        content: content || null,
      },
      accessType,
    });

  } catch (error) {
    console.error("❌ GET Lesson Content Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------
// PATCH – Update Lesson Content (Instructor Only)
// ---------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; lessonId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, lessonId } = params;
    console.log("✏️ PATCH Lesson Content - courseSlug:", courseSlug, "lessonId:", lessonId);

    // Auth required for updates
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await getAppUser(session.user.id);
    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get course
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // Only instructor or admin can update
    const canEdit = course.instructorId === appUser.id || appUser.role === 'admin';
    if (!canEdit) {
      return NextResponse.json({ error: "Permission denied" }, { status: 403 });
    }

    // Verify lesson belongs to this course
    const [lesson] = await db
      .select()
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, course.id)))
      .limit(1);

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const body = await req.json();
    console.log("📝 Update body:", body);

    const {
      title,
      content,
      durationMinutes,
      videoUrl,
      videoPlaybackId,
      isFree,
      resources,
    } = body;

    // Update lesson title if provided
    if (title) {
      const slug = title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "")
        .slice(0, 255);

      await db
        .update(lessons)
        .set({
          title,
          slug,
          updatedAt: new Date(),
        })
        .where(eq(lessons.id, lessonId));

      console.log("✅ Lesson title updated");
    }

    // Update or create lesson content
    const contentUpdate: any = {};
    if (content !== undefined) contentUpdate.content = content;
    if (durationMinutes !== undefined) contentUpdate.durationMinutes = durationMinutes;
    if (videoUrl !== undefined) contentUpdate.videoUrl = videoUrl;
    if (videoPlaybackId !== undefined) contentUpdate.videoPlaybackId = videoPlaybackId;
    if (isFree !== undefined) contentUpdate.isFree = isFree;
    if (resources !== undefined) contentUpdate.resources = resources;

    if (Object.keys(contentUpdate).length > 0) {
      contentUpdate.updatedAt = new Date();

      const [existing] = await db
        .select()
        .from(lessonContent)
        .where(eq(lessonContent.lessonId, lessonId));

      if (existing) {
        await db
          .update(lessonContent)
          .set(contentUpdate)
          .where(eq(lessonContent.lessonId, lessonId));
        console.log("✅ Lesson content updated");
      } else {
        await db.insert(lessonContent).values({
          lessonId,
          ...contentUpdate,
        });
        console.log("✅ Lesson content created");
      }
    }

    // Fetch updated lesson with content
    const [updatedLesson] = await db
      .select()
      .from(lessons)
      .where(eq(lessons.id, lessonId))
      .limit(1);

    const [updatedContent] = await db
      .select()
      .from(lessonContent)
      .where(eq(lessonContent.lessonId, lessonId))
      .limit(1);

    console.log("✅ Updated lesson fetched");
    return NextResponse.json({
      lesson: {
        ...updatedLesson,
        content: updatedContent || null,
      },
    });

  } catch (error) {
    console.error("❌ PATCH Lesson Content Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}