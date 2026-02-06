// app/api/enrollments/[enrollmentId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { enrollments, courses, app_users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// ========================================
// Validation Schema
// ========================================
const updateEnrollmentSchema = z.object({
  status: z.enum(["active", "completed", "cancelled", "expired"]).optional(),
  progressPercent: z.number().min(0).max(100).optional(),
  lastAccessedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional(),
});

// ========================================
// GET - Get Single Enrollment
// ========================================
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;

    // 1. Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Get enrollment with course details
    const [enrollment] = await db
      .select({
        id: enrollments.id,
        status: enrollments.status,
        progressPercent: enrollments.progressPercent,
        enrolledAt: enrollments.enrolledAt,
        completedAt: enrollments.completedAt,
        lastAccessedAt: enrollments.lastAccessedAt,
        expiresAt: enrollments.expiresAt,
        paymentId: enrollments.paymentId,
        // Course info
        courseId: courses.id,
        courseTitle: courses.title,
        courseSlug: courses.slug,
        courseDescription: courses.description,
        courseThumbnail: courses.thumbnail,
        coursePrice: courses.price,
        courseLevel: courses.level,
        courseDurationHours: courses.durationHours,
        courseInstructorId: courses.instructorId,
      })
      .from(enrollments)
      .leftJoin(courses, eq(enrollments.courseId, courses.id))
      .where(
        and(
          eq(enrollments.id, enrollmentId),
          eq(enrollments.appUserId, appUser.id)
        )
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      enrollment,
    });
  } catch (error: any) {
    console.error("Get enrollment error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// ========================================
// PATCH - Update Enrollment
// ========================================
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;

    // 1. Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Verify enrollment belongs to user
    const [existingEnrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.id, enrollmentId),
          eq(enrollments.appUserId, appUser.id)
        )
      )
      .limit(1);

    if (!existingEnrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      );
    }

    // 4. Parse and validate update data
    const body = await req.json();
    const parsed = updateEnrollmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const updateData = parsed.data;

    // 5. Build update object
    const updates: any = {};

    if (updateData.status !== undefined) {
      updates.status = updateData.status;
    }

    if (updateData.progressPercent !== undefined) {
      updates.progressPercent = updateData.progressPercent;
      
      // Auto-complete if 100%
      if (updateData.progressPercent === 100 && !existingEnrollment.completedAt) {
        updates.status = "completed";
        updates.completedAt = new Date();
      }
    }

    if (updateData.lastAccessedAt) {
      updates.lastAccessedAt = new Date(updateData.lastAccessedAt);
    }

    if (updateData.completedAt) {
      updates.completedAt = new Date(updateData.completedAt);
      updates.status = "completed";
      updates.progressPercent = 100;
    }

    // 6. Update enrollment
    const [updatedEnrollment] = await db
      .update(enrollments)
      .set(updates)
      .where(eq(enrollments.id, enrollmentId))
      .returning();

    return NextResponse.json({
      success: true,
      message: "Enrollment updated successfully",
      enrollment: updatedEnrollment,
    });
  } catch (error: any) {
    console.error("Update enrollment error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// ========================================
// DELETE - Cancel Enrollment
// ========================================
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  try {
    const { enrollmentId } = await params;

    // 1. Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 3. Get enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.id, enrollmentId),
          eq(enrollments.appUserId, appUser.id)
        )
      )
      .limit(1);

    if (!enrollment) {
      return NextResponse.json(
        { error: "Enrollment not found" },
        { status: 404 }
      );
    }

    // 4. Don't actually delete - just cancel
    // (Keep data for analytics)
    const [cancelled] = await db
      .update(enrollments)
      .set({
        status: "cancelled",
      })
      .where(eq(enrollments.id, enrollmentId))
      .returning();

    // 5. Update course enrollment count
    await db
      .update(courses)
      .set({
        enrollmentCount: Math.max(0, (enrollment.courseId ? 
          (await db.select().from(courses).where(eq(courses.id, enrollment.courseId)).limit(1))[0]?.enrollmentCount || 0
        : 0) - 1),
      })
      .where(eq(courses.id, enrollment.courseId));

    return NextResponse.json({
      success: true,
      message: "Enrollment cancelled successfully",
      enrollment: cancelled,
    });
  } catch (error: any) {
    console.error("Delete enrollment error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}