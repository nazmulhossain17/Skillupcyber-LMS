// app/api/courses/[courseSlug]/sections/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { sections, courses, app_users } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { z } from "zod";

// Validation schema
const createSectionSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(255),
  description: z.string().optional().nullable(),
  type: z.enum(['lessons', 'quiz', 'assignment']).default('lessons'),
  order: z.number().min(0),
});

const updateSectionSchema = z.object({
  title: z.string().min(3).max(255).optional(),
  description: z.string().optional().nullable(),
  order: z.number().min(0).optional(),
});

// Helper: Get instructor UUID
async function getInstructorId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

// GET - List all sections for a course
// app/api/courses/[courseSlug]/sections/route.ts
// PUBLIC ROUTE - No authentication required


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  try {
    const { courseSlug } = await params;

    console.log('📋 GET Sections - Course slug:', courseSlug);

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      console.log('❌ No session found');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    

    // Get course and verify ownership
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      console.log('❌ Course not found');
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    console.log('📚 Course found:', course.id);

    

    // Fetch all sections for this course
    const courseSections = await db
      .select({
        id: sections.id,
        title: sections.title,
        description: sections.description,
        type: sections.type,
        order: sections.order,
        position: sections.position,
        courseId: sections.courseId,
        createdAt: sections.createdAt,
        updatedAt: sections.updatedAt,
      })
      .from(sections)
      .where(eq(sections.courseId, course.id))
      .orderBy(asc(sections.order));

    console.log('✅ Found sections:', courseSections.length);

    return NextResponse.json(
      { sections: courseSections },
      {
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
      }
    );
  } catch (error) {
    console.error("❌ GET Sections Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch sections" },
      { status: 500 }
    );
  }
}

// POST - Create new section
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  try {
    const { courseSlug } = await params;

    console.log('➕ POST Section - Course slug:', courseSlug);

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get course and verify ownership
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.instructorId !== instructorId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await req.json();
    console.log('📝 Request body:', body);

    const validatedData = createSectionSchema.parse(body);

    // Create section
    const [newSection] = await db
      .insert(sections)
      .values({
        title: validatedData.title,
        description: validatedData.description || null,
        type: validatedData.type,
        order: validatedData.order,
        position: validatedData.order, // Same as order initially
        courseId: course.id,
      })
      .returning();

    console.log('✅ Section created:', newSection.id);

    return NextResponse.json(
      { section: newSection },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ POST Section Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create section" },
      { status: 500 }
    );
  }
}

// PATCH - Update section
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  try {
    const { courseSlug } = await params;
    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get('sectionId');

    if (!sectionId) {
      return NextResponse.json(
        { error: "Section ID is required" },
        { status: 400 }
      );
    }

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get course and verify ownership
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.instructorId !== instructorId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Parse and validate request body
    const body = await req.json();
    const validatedData = updateSectionSchema.parse(body);

    // Update section
    const [updatedSection] = await db
      .update(sections)
      .set({
        ...(validatedData.title && { title: validatedData.title }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.order !== undefined && { order: validatedData.order }),
        updatedAt: new Date(),
      })
      .where(eq(sections.id, sectionId))
      .returning();

    if (!updatedSection) {
      return NextResponse.json({ error: "Section not found" }, { status: 404 });
    }

    return NextResponse.json({ section: updatedSection });
  } catch (error) {
    console.error("❌ PATCH Section Error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update section" },
      { status: 500 }
    );
  }
}

// DELETE - Delete section
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ courseSlug: string }> }
) {
  try {
    const { courseSlug } = await params;
    const { searchParams } = new URL(req.url);
    const sectionId = searchParams.get('sectionId');

    if (!sectionId) {
      return NextResponse.json(
        { error: "Section ID is required" },
        { status: 400 }
      );
    }

    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const instructorId = await getInstructorId(session.user.id);
    if (!instructorId) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Get course and verify ownership
    const [course] = await db
      .select({ id: courses.id, instructorId: courses.instructorId })
      .from(courses)
      .where(eq(courses.slug, courseSlug))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    if (course.instructorId !== instructorId) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Delete section (cascade will handle related content)
    await db
      .delete(sections)
      .where(eq(sections.id, sectionId));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("❌ DELETE Section Error:", error);
    return NextResponse.json(
      { error: "Failed to delete section" },
      { status: 500 }
    );
  }
}