// app/api/courses/[courseSlug]/lessons/[lessonId]/resources/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { lessons, resources, courses, app_users, enrollments } from "@/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";

async function getInstructorId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id ?? null;
}

// Helper: Get app_user ID from userId


async function verifyCourseOwnership(slug: string, instructorId: string) {
  const [course] = await db
    .select({ id: courses.id, instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);
  if (!course || course.instructorId !== instructorId) return null;
  return course;
}

// GET - Fetch all resources for a lesson
async function getAppUserId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

// GET - Get resources for a lesson
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string; lessonId: string }> }
) {
  try {
    const { courseSlug, lessonId } = await params;

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUserId = await getAppUserId(session.user.id);
    if (!appUserId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get course with instructor info
    const [course] = await db
      .select({ 
        id: courses.id,
        instructorId: courses.instructorId 
      })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // ✅ FIX: Check if user is the instructor OR enrolled
    const isInstructor = course.instructorId === appUserId;
    
    if (!isInstructor) {
      // Only check enrollment if not the instructor
      const [enrollment] = await db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, course.id),
            eq(enrollments.appUserId, appUserId)
          )
        )
        .limit(1);

      if (!enrollment) {
        return NextResponse.json({ error: "Not enrolled" }, { status: 403 });
      }
    }

    // Verify lesson belongs to course
    const [lesson] = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(
        and(
          eq(lessons.id, lessonId),
          eq(lessons.courseId, course.id)
        )
      )
      .limit(1);

    if (!lesson) {
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    // Get resources for this lesson
    const lessonResources = await db
      .select({
        id: resources.id,
        title: resources.title,
        type: resources.type,
        url: resources.url,
        fileSize: resources.fileSize,
        mimeType: resources.mimeType,
        description: resources.description,
        isDownloadable: resources.isDownloadable,
      })
      .from(resources)
      .where(eq(resources.lessonId, lessonId))
      .orderBy(asc(resources.order));

    return NextResponse.json({ resources: lessonResources });
  } catch (error) {
    console.error("❌ Get Resources Error:", error);
    return NextResponse.json(
      { error: "Failed to get resources" },
      { status: 500 }
    );
  }
}
// POST - Create a new resource
export async function POST(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; lessonId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, lessonId } = params;
    console.log("➕ POST Resource - courseSlug:", courseSlug, "lessonId:", lessonId);

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

    // Verify lesson belongs to course
    const [lesson] = await db
      .select()
      .from(lessons)
      .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, course.id)))
      .limit(1);

    if (!lesson) {
      console.error("❌ Lesson not found");
      return NextResponse.json({ error: "Lesson not found" }, { status: 404 });
    }

    const body = await req.json();
    console.log("📝 Request body:", body);

    const { title, type, url, fileKey, fileSize, mimeType, description, isDownloadable } = body;

    if (!title?.trim() || !type || !url) {
      console.error("❌ Missing required fields");
      return NextResponse.json(
        { error: "Title, type, and URL are required" },
        { status: 400 }
      );
    }

    // Get last order
    const [lastResource] = await db
      .select({ order: resources.order })
      .from(resources)
      .where(eq(resources.lessonId, lessonId))
      .orderBy(asc(resources.order))
      .limit(1);

    const nextOrder = lastResource ? lastResource.order + 1 : 0;

    const [newResource] = await db
      .insert(resources)
      .values({
        lessonId,
        title: title.trim(),
        type,
        url,
        fileKey: fileKey || null,
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        description: description?.trim() || null,
        order: nextOrder,
        isDownloadable: isDownloadable ?? true,
      })
      .returning();

    console.log("✅ Resource created:", newResource.id);
    return NextResponse.json({ resource: newResource }, { status: 201 });
  } catch (error) {
    console.error("❌ POST Resource Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// PATCH - Update a resource
export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; lessonId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, lessonId } = params;
    
    const resourceId = new URL(req.url).searchParams.get("resourceId");
    console.log("✏️ PATCH Resource - resourceId:", resourceId);

    if (!resourceId) {
      return NextResponse.json({ error: "Missing resourceId" }, { status: 400 });
    }

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const course = await verifyCourseOwnership(courseSlug, instructorId);
    if (!course) {
      return NextResponse.json({ error: "Course not found or access denied" }, { status: 404 });
    }

    const body = await req.json();
    const updateData: any = {};

    if (body.title) updateData.title = body.title.trim();
    if (body.description !== undefined) updateData.description = body.description?.trim() || null;
    if (body.url) updateData.url = body.url;
    if (body.isDownloadable !== undefined) updateData.isDownloadable = body.isDownloadable;
    if (body.order !== undefined) updateData.order = body.order;

    if (Object.keys(updateData).length > 0) {
      updateData.updatedAt = new Date();
      await db
        .update(resources)
        .set(updateData)
        .where(eq(resources.id, resourceId));
    }

    const [updatedResource] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, resourceId))
      .limit(1);

    console.log("✅ Resource updated");
    return NextResponse.json({ resource: updatedResource });
  } catch (error) {
    console.error("❌ PATCH Resource Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE - Delete a resource
export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ courseSlug: string; lessonId: string }> }
) {
  try {
    const params = await context.params;
    const { courseSlug, lessonId } = params;
    
    const resourceId = new URL(req.url).searchParams.get("resourceId");
    console.log("🗑️ DELETE Resource - resourceId:", resourceId);

    if (!resourceId) {
      return NextResponse.json({ error: "Missing resourceId" }, { status: 400 });
    }

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const course = await verifyCourseOwnership(courseSlug, instructorId);
    if (!course) {
      return NextResponse.json({ error: "Course not found or access denied" }, { status: 404 });
    }

    // Get resource details before deleting
    const [resource] = await db
      .select()
      .from(resources)
      .where(eq(resources.id, resourceId))
      .limit(1);

    if (!resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    // Delete file from S3 if it's a file resource
    if (resource.fileKey) {
      try {
        await fetch("/api/s3/delete", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: resource.fileKey }),
        });
        console.log("✅ File deleted from S3");
      } catch (err) {
        console.error("❌ Failed to delete file from S3:", err);
      }
    }

    await db.delete(resources).where(eq(resources.id, resourceId));
    console.log("✅ Resource deleted");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ DELETE Resource Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}