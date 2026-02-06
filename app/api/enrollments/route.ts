// app/api/enrollments/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { enrollments, courses, app_users, payments } from "@/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import arcjet, { detectBot, fixedWindow } from "@arcjet/next";

// ========================================
// Arcjet Protection
// ========================================
const aj = arcjet({
  key: process.env.ARCJET_KEY!,
  rules: [
    detectBot({
      mode: "LIVE",
      allow: [],
    }),
    fixedWindow({
      mode: "LIVE",
      window: "1m",
      max: 10, // 10 requests per minute
    }),
  ],
});

// ========================================
// Validation Schemas
// ========================================
const createEnrollmentSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  paymentId: z.string().uuid("Invalid payment ID").optional(),
});

// ========================================
// POST - Create Enrollment
// ========================================
export async function POST(req: NextRequest) {
  try {
    // 1. Auth check
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Arcjet protection
    const decision = await aj.protect(req);

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return NextResponse.json(
          { error: "Too many requests. Please try again later." },
          { status: 429 }
        );
      }

      if (decision.reason.isBot()) {
        return NextResponse.json(
          { error: "Bot detected" },
          { status: 403 }
        );
      }

      return NextResponse.json(
        { error: "Request blocked" },
        { status: 403 }
      );
    }

    // 3. Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // 4. Parse request body
    const body = await req.json();
    const parsed = createEnrollmentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { courseId, paymentId } = parsed.data;

    // 5. Check if course exists
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, courseId))
      .limit(1);

    if (!course) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    // 6. Check if already enrolled
    const [existingEnrollment] = await db
      .select()
      .from(enrollments)
      .where(
        and(
          eq(enrollments.appUserId, appUser.id),
          eq(enrollments.courseId, courseId)
        )
      )
      .limit(1);

    if (existingEnrollment) {
      return NextResponse.json(
        { 
          error: "Already enrolled", 
          enrollment: existingEnrollment 
        },
        { status: 409 }
      );
    }

    // 7. Payment check - TEMPORARILY DISABLED for free enrollment
    // TODO: Re-enable when implementing payment integration
    /*
    if (Number(course.price) > 0) {
      if (!paymentId) {
        return NextResponse.json(
          { error: "Payment required for this course" },
          { status: 402 }
        );
      }

      // Verify payment exists and belongs to user
      const [payment] = await db
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.id, paymentId),
            eq(payments.appUserId, appUser.id),
            eq(payments.courseId, courseId)
          )
        )
        .limit(1);

      if (!payment) {
        return NextResponse.json(
          { error: "Payment not found or invalid" },
          { status: 404 }
        );
      }

      if (payment.status !== "succeeded") {
        return NextResponse.json(
          { error: "Payment not completed" },
          { status: 402 }
        );
      }
    }
    */
    // ✅ For now, all courses are free to enroll

    // 8. Create enrollment
    const [newEnrollment] = await db
      .insert(enrollments)
      .values({
        appUserId: appUser.id,
        courseId,
        paymentId: paymentId || null,
        status: "active",
        progressPercent: 0,
        enrolledAt: new Date(),
      })
      .returning();

    // 9. Update course enrollment count
    await db
      .update(courses)
      .set({
        enrollmentCount: course.enrollmentCount + 1,
      })
      .where(eq(courses.id, courseId));

    return NextResponse.json(
      {
        success: true,
        message: "Successfully enrolled in course",
        enrollment: newEnrollment,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Create enrollment error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

// ========================================
// GET - Get User Enrollments
// ========================================
export async function GET(req: NextRequest) {
  try {
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

    // 3. Get query parameters
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const courseId = searchParams.get("courseId");

    // 4. Build query conditions
    const conditions = [eq(enrollments.appUserId, appUser.id)];
    
    if (status) {
      conditions.push(eq(enrollments.status, status as any));
    }
    
    if (courseId) {
      conditions.push(eq(enrollments.courseId, courseId));
    }

    // 5. Execute query with all conditions
    const userEnrollments = await db
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
        courseThumbnail: courses.thumbnail,
        coursePrice: courses.price,
        courseLevel: courses.level,
        courseDurationHours: courses.durationHours,
      })
      .from(enrollments)
      .leftJoin(courses, eq(enrollments.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(desc(enrollments.enrolledAt));

    return NextResponse.json({
      success: true,
      count: userEnrollments.length,
      enrollments: userEnrollments,
    });
  } catch (error: any) {
    console.error("Get enrollments error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}