// app/api/courses/[courseSlug]/sections/[sectionId]/lessons/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { lessons, lessonContent, sections, courses, app_users } from "@/db/schema";
import { desc, eq, and } from "drizzle-orm";
import { auth } from "@/lib/auth";

// --------------------------
// Helper: Create slug
// --------------------------
function createSlug(str: string) {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 255);
}

// --------------------------
// Helper: Get instructor UUID
// --------------------------
async function getInstructorId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);

  return user?.id ?? null;
}

// --------------------------
// Helper: Verify course ownership
// --------------------------
async function verifyCourseOwnership(slug: string, instructorId: string) {
  const [course] = await db
    .select({ id: courses.id, instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  if (!course || course.instructorId !== instructorId) return null;
  return course;
}

// ---------------------------------------------------------
// GET – Get All Lessons in Section
// ---------------------------------------------------------
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; sectionId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, sectionId } = params;

    if (!courseSlug || !sectionId) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }

    // 1. Verify course exists
    const [course] = await db
      .select({ id: courses.id, published: courses.published })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 2. Verify section belongs to course
    const [section] = await db
      .select({ id: sections.id })
      .from(sections)
      .where(and(eq(sections.id, sectionId), eq(sections.courseId, course.id)))
      .limit(1);

    if (!section) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    // 3. Fetch lessons + content
    const sectionLessons = await db
      .select({
        id: lessons.id,
        title: lessons.title,
        slug: lessons.slug,
        order: lessons.order,
        sectionId: lessons.sectionId,
        courseId: lessons.courseId,
        createdAt: lessons.createdAt,
        updatedAt: lessons.updatedAt,
        durationMinutes: lessonContent.durationMinutes,
        isFree: lessonContent.isFree,
        videoUrl: lessonContent.videoUrl,
        videoPlaybackId: lessonContent.videoPlaybackId,
      })
      .from(lessons)
      .leftJoin(lessonContent, eq(lessons.id, lessonContent.lessonId))
      .where(eq(lessons.sectionId, sectionId))
      .orderBy(lessons.order);

    return NextResponse.json({ lessons: sectionLessons });
  } catch (error) {
    console.error("GET Lessons Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ---------------------------------------------------------
// POST – Create Lesson
// ---------------------------------------------------------
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; sectionId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, sectionId } = params;
    console.log("➕ POST Lesson - courseSlug:", courseSlug, "sectionId:", sectionId);

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      console.error("❌ Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    console.log("👤 Instructor ID:", instructorId);
    
    if (!instructorId) {
      console.error("❌ Profile not found");
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const course = await verifyCourseOwnership(courseSlug, instructorId);
    if (!course) {
      console.error("❌ Course not found or access denied");
      return NextResponse.json({ error: "Course not found or access denied" }, { status: 404 });
    }

    const [section] = await db
      .select()
      .from(sections)
      .where(and(eq(sections.id, sectionId), eq(sections.courseId, course.id)))
      .limit(1);

    if (!section) {
      console.error("❌ Section not found");
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    const body = await req.json();
    console.log("📝 Request body:", body);
    
    const { title, content, durationMinutes, videoUrl, videoPlaybackId, isFree } = body;
    
    if (!title?.trim()) {
      console.error("❌ Title is required");
      return NextResponse.json({ error: "Title is required" }, { status: 400 });
    }

    const slug = createSlug(title);
    console.log("🔗 Generated slug:", slug);

    // Get next order number
    const [lastLesson] = await db
      .select({ order: lessons.order })
      .from(lessons)
      .where(eq(lessons.sectionId, sectionId))
      .orderBy(desc(lessons.order))
      .limit(1);

    const nextOrder = lastLesson ? lastLesson.order + 1 : 1;
    console.log("📊 Next order:", nextOrder);

    // ✅ 1. Create lesson
    const [newLesson] = await db
      .insert(lessons)
      .values({
        title,
        slug,
        order: nextOrder,
        sectionId,
        courseId: course.id,
      })
      .returning();

    console.log("✅ Lesson created:", newLesson.id);

    // ✅ 2. Create lesson content WITH the data from request
    const [newContent] = await db
      .insert(lessonContent)
      .values({
        lessonId: newLesson.id,
        content: content || null, // ✅ Save content
        durationMinutes: durationMinutes || 0, // ✅ Save duration
        videoUrl: videoUrl || null, // ✅ Save video URL
        videoPlaybackId: videoPlaybackId || null, // ✅ Save playback ID
        isFree: isFree || false, // ✅ Save free preview flag
        resources: null,
      })
      .returning();

    console.log("✅ Lesson content created with data:", newContent);

    // ✅ 3. Return complete lesson with content embedded
    const completeLesson = {
      id: newLesson.id,
      title: newLesson.title,
      slug: newLesson.slug,
      order: newLesson.order,
      sectionId: newLesson.sectionId,
      courseId: newLesson.courseId,
      createdAt: newLesson.createdAt,
      updatedAt: newLesson.updatedAt,
      content: {
        id: newContent.id,
        lessonId: newContent.lessonId,
        content: newContent.content,
        durationMinutes: newContent.durationMinutes,
        videoUrl: newContent.videoUrl,
        videoPlaybackId: newContent.videoPlaybackId,
        isFree: newContent.isFree,
        resources: newContent.resources,
        createdAt: newContent.createdAt,
        updatedAt: newContent.updatedAt,
      },
    };

    console.log("✅ Complete lesson with content:", completeLesson);
    
    return NextResponse.json({ lesson: completeLesson }, { status: 201 });
  } catch (error) {
    console.error("❌ POST Lesson Error:", error);
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

// ---------------------------------------------------------
// PATCH – Update Lesson
// ---------------------------------------------------------
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; sectionId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, sectionId } = params;
    console.log("✏️ PATCH Lesson - courseSlug:", courseSlug, "sectionId:", sectionId);

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      console.error("❌ Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      console.error("❌ Profile not found");
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const course = await verifyCourseOwnership(courseSlug, instructorId);
    if (!course) {
      console.error("❌ Course not found or access denied");
      return NextResponse.json({ error: "Course not found or access denied" }, { status: 404 });
    }

    const lessonId = new URL(req.url).searchParams.get("lessonId");
    console.log("🆔 Lesson ID:", lessonId);
    
    if (!lessonId) {
      console.error("❌ Missing lessonId");
      return NextResponse.json({ error: "Missing lessonId" }, { status: 400 });
    }

    // Verify lesson belongs to correct section & course
    const [lessonExists] = await db
      .select()
      .from(lessons)
      .where(
        and(
          eq(lessons.id, lessonId),
          eq(lessons.sectionId, sectionId),
          eq(lessons.courseId, course.id)
        )
      )
      .limit(1);

    if (!lessonExists) {
      console.error("❌ Lesson not found or access denied");
      return NextResponse.json({ error: "Lesson not found or access denied" }, { status: 404 });
    }

    const body = await req.json();
    console.log("📝 Update body:", body);
    
    const { title, content, durationMinutes, videoUrl, videoPlaybackId, isFree, order } = body;

    // Update lesson table
    const lessonUpdate: any = {};
    if (title) {
      lessonUpdate.title = title;
      lessonUpdate.slug = createSlug(title);
    }
    if (order !== undefined) lessonUpdate.order = order;
    
    if (Object.keys(lessonUpdate).length > 0) {
      lessonUpdate.updatedAt = new Date();
      await db.update(lessons).set(lessonUpdate).where(eq(lessons.id, lessonId));
      console.log("✅ Lesson updated");
    }

    // Update lesson content
    const contentUpdate: any = {};
    if (content !== undefined) contentUpdate.content = content;
    if (durationMinutes !== undefined) contentUpdate.durationMinutes = durationMinutes;
    if (videoUrl !== undefined) contentUpdate.videoUrl = videoUrl;
    if (videoPlaybackId !== undefined) contentUpdate.videoPlaybackId = videoPlaybackId;
    if (isFree !== undefined) contentUpdate.isFree = isFree;

    if (Object.keys(contentUpdate).length > 0) {
      contentUpdate.updatedAt = new Date();
      const [existing] = await db
        .select()
        .from(lessonContent)
        .where(eq(lessonContent.lessonId, lessonId));

      if (existing) {
        await db.update(lessonContent).set(contentUpdate).where(eq(lessonContent.lessonId, lessonId));
        console.log("✅ Lesson content updated");
      } else {
        await db.insert(lessonContent).values({ lessonId, ...contentUpdate });
        console.log("✅ Lesson content created");
      }
    }

    // Fetch and return updated lesson
    const [updatedLesson] = await db
      .select({
        id: lessons.id,
        title: lessons.title,
        slug: lessons.slug,
        order: lessons.order,
        sectionId: lessons.sectionId,
        courseId: lessons.courseId,
        createdAt: lessons.createdAt,
        updatedAt: lessons.updatedAt,
        contentId: lessonContent.id,
        content: lessonContent.content,
        durationMinutes: lessonContent.durationMinutes,
        videoUrl: lessonContent.videoUrl,
        videoPlaybackId: lessonContent.videoPlaybackId,
        isFree: lessonContent.isFree,
        resources: lessonContent.resources,
      })
      .from(lessons)
      .leftJoin(lessonContent, eq(lessons.id, lessonContent.lessonId))
      .where(eq(lessons.id, lessonId))
      .limit(1);

    console.log("✅ Updated lesson fetched:", updatedLesson);
    return NextResponse.json({ lesson: updatedLesson });
  } catch (error) {
    console.error("❌ PATCH Lesson Error:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

// ---------------------------------------------------------
// DELETE – Delete Lesson
// ---------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; sectionId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, sectionId } = params;
    console.log("🗑️ DELETE Lesson - courseSlug:", courseSlug, "sectionId:", sectionId);

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      console.error("❌ Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      console.error("❌ Profile not found");
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const course = await verifyCourseOwnership(courseSlug, instructorId);
    if (!course) {
      console.error("❌ Course not found or access denied");
      return NextResponse.json({ error: "Course not found or access denied" }, { status: 404 });
    }

    const lessonId = new URL(req.url).searchParams.get("lessonId");
    console.log("🆔 Lesson ID:", lessonId);
    
    if (!lessonId) {
      console.error("❌ Missing lessonId");
      return NextResponse.json({ error: "Missing lessonId" }, { status: 400 });
    }

    // Ensure lesson belongs to the section & course
    const [target] = await db
      .select()
      .from(lessons)
      .where(
        and(
          eq(lessons.id, lessonId),
          eq(lessons.sectionId, sectionId),
          eq(lessons.courseId, course.id)
        )
      )
      .limit(1);

    if (!target) {
      console.error("❌ Lesson not found or access denied");
      return NextResponse.json({ error: "Lesson not found or access denied" }, { status: 404 });
    }

    // Delete lesson content first (due to foreign key)
    await db.delete(lessonContent).where(eq(lessonContent.lessonId, lessonId));
    console.log("✅ Lesson content deleted");
    
    // Delete lesson
    await db.delete(lessons).where(eq(lessons.id, lessonId));
    console.log("✅ Lesson deleted");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ DELETE Lesson Error:", error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}