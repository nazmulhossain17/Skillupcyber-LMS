// app/api/courses/[courseSlug]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { courses, app_users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import arcjet, { fixedWindow } from "@/lib/arcjet";

// Helper: Get instructor UUID from Better Auth text ID
async function getInstructorId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

const aj = arcjet.withRule(
  fixedWindow({
    mode: "LIVE",
    window: "1m",
    max: 5,
  })
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  const { courseSlug } = await params;

  if (!courseSlug) {
    return NextResponse.json({ error: "Missing course slug" }, { status: 400 });
  }

  const [courseData] = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      shortDescription: courses.shortDescription,
      description: courses.description,
      thumbnail: courses.thumbnail,
      price: courses.price,
      discountPrice: courses.discountPrice,
      level: courses.level,
      language: courses.language,
      durationMinutes: courses.durationHours,
      published: courses.published,
      enrollmentCount: courses.enrollmentCount,
      averageRating: courses.averageRating,
      reviewCount: courses.reviewCount,
      requirements: courses.requirements,
      learningOutcomes: courses.learningOutcomes,
      targetAudience: courses.targetAudience,
      createdAt: courses.createdAt,
      instructorName: app_users.name,
      instructorAvatar: app_users.avatar,
      instructorBio: app_users.bio,
    })
    .from(courses)
    .leftJoin(app_users, eq(courses.instructorId, app_users.id))
    .where(eq(courses.slug, courseSlug))
    .limit(1);

  if (!courseData) {
    return NextResponse.json({ error: "Course not found" }, { status: 404 });
  }

  // Only return published courses to the public
  

  const course = {
    id: courseData.id,
    title: courseData.title,
    slug: courseData.slug,
    shortDescription: courseData.shortDescription,
    description: courseData.description,
    thumbnail: courseData.thumbnail,
    price: courseData.price,
    discountPrice: courseData.discountPrice,
    level: courseData.level,
    language: courseData.language,
    durationMinutes: courseData.durationMinutes,
    published: courseData.published,
    enrollmentCount: courseData.enrollmentCount || 0,
    averageRating: courseData.averageRating || "0.00",
    reviewCount: courseData.reviewCount || 0,
    requirements: courseData.requirements || [],
    learningOutcomes: courseData.learningOutcomes || [],
    targetAudience: courseData.targetAudience || [],
    createdAt: courseData.createdAt,
    instructor: {
      name: courseData.instructorName || "Anonymous Instructor",
      avatar: courseData.instructorAvatar || "https://cdn-icons-png.flaticon.com/512/149/149071.png",
      bio: courseData.instructorBio || null,
    },
  };

  return NextResponse.json({ course });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  const { courseSlug } = await params;

  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const instructorId = await getInstructorId(session.user.id);
  if (!instructorId) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const body = await req.json();

  const [existingCourse] = await db
    .select({ id: courses.id, instructorId: courses.instructorId })
    .from(courses)
    .where(eq(courses.slug, courseSlug))
    .limit(1);

  if (!existingCourse || existingCourse.instructorId !== instructorId) {
    return NextResponse.json({ error: "Course not found or access denied" }, { status: 404 });
  }

  // Build update object with only the fields that were actually sent
  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (body.title !== undefined) updateData.title = body.title;
  if (body.slug !== undefined) updateData.slug = body.slug;
  if (body.shortDescription !== undefined) updateData.shortDescription = body.shortDescription;
  if (body.description !== undefined) updateData.description = body.description;
  if (body.price !== undefined) updateData.price = body.price?.toString();
  if ('discountPrice' in body) updateData.discountPrice = body.discountPrice ? body.discountPrice.toString() : null;
  if (body.level !== undefined) updateData.level = body.level;
  if (body.language !== undefined) updateData.language = body.language;
  if (body.published !== undefined) updateData.published = body.published;

  if (body.durationHours !== undefined) {
    const totalMinutes = Number(body.durationHours) * 60 + Number(body.durationMinutes || 0);
    updateData.durationHours = totalMinutes;
  }

  const [updated] = await db
    .update(courses)
    .set(updateData)
    .where(eq(courses.id, existingCourse.id))
    .returning();

  return NextResponse.json({ course: updated });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  const { courseSlug } = await params;

  // -------------------------------
  // 1. AUTHENTICATION
  // -------------------------------
  const session = await auth.api.getSession({ headers: req.headers });

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // -------------------------------
  // 2. GET INSTRUCTOR ID
  // -------------------------------
  const instructorId = await getInstructorId(session.user.id);

  if (!instructorId) {
    return NextResponse.json(
      { error: "Profile not found" },
      { status: 404 }
    );
  }

  // -------------------------------
  // 3. ARCJET RATE LIMIT CHECK
  // -------------------------------
  const decision = await aj.protect(req, {
    fingerprint: session.user.id,
  });

  if (decision.isDenied()) {
    // Specific rate-limit denial
    if (decision.reason.isRateLimit()) {
      return NextResponse.json(
        {
          status: "error",
          message:
            "Too many delete requests. You're temporarily blocked. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Other denial types
    return NextResponse.json(
      {
        status: "error",
        message: "Access denied by security policy.",
      },
      { status: 403 }
    );
  }

  // -------------------------------
  // 4. FETCH COURSE + VERIFY OWNER
  // -------------------------------
  const [course] = await db
    .select({
      id: courses.id,
      instructorId: courses.instructorId,
    })
    .from(courses)
    .where(eq(courses.slug, courseSlug))
    .limit(1);

  if (!course) {
    return NextResponse.json(
      { error: "Course not found" },
      { status: 404 }
    );
  }

  if (course.instructorId !== instructorId) {
    return NextResponse.json(
      { error: "Access denied" },
      { status: 403 }
    );
  }

  // -------------------------------
  // 5. DELETE COURSE
  // -------------------------------
  await db.delete(courses).where(eq(courses.id, course.id));

  return NextResponse.json(
    {
      success: true,
      message: "Course deleted successfully",
    },
    { status: 200 }
  );
}