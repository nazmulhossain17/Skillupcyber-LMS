// app/api/courses/create/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { courses, app_users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import arcjet, { fixedWindow } from "@/lib/arcjet";

// ✅ FIXED: Accept both full URLs and /api/media/ paths for thumbnail
const createCourseSchema = z.object({
  title: z.string().min(5),
  description: z.string().min(20),
  shortDescription: z.string().optional(),
  thumbnail: z.string().min(1).refine(
    (val) => val.startsWith('/api/media/') || val.startsWith('/api/files/') || val.startsWith('http'),
    "Invalid thumbnail URL"
  ).optional(),
  price: z.coerce.number().min(0),
  discountPrice: z.coerce.number().min(0).optional(),
  level: z.enum(["beginner", "intermediate", "advanced", "expert"]).default("beginner"),
  categoryId: z.string().uuid().nullable().optional(),
  language: z.string().default("English"),
  durationHours: z.number().int().min(0).optional(),
  requirements: z.array(z.string()).optional(),
  learningOutcomes: z.array(z.string()).optional(),
  targetAudience: z.array(z.string()).optional(),
});

const aj = arcjet.withRule(
  fixedWindow({
    mode: "LIVE",
    window: "1m",
    max: 5,
  })
)

export async function POST(req: NextRequest) {
  try {
    // -----------------------------
    // 1. Get session
    // -----------------------------
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // -----------------------------
    // 2. Rate-limit check
    // -----------------------------
    const decision = await aj.protect(req, {
      fingerprint: session.user.id,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        return NextResponse.json(
          {
            status: "error",
            message:
              "Too many requests. You are temporarily blocked. Try again later.",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          status: "error",
          message: "Access denied by security policy.",
        },
        { status: 403 }
      );
    }

    // -----------------------------
    // 3. Load app user
    // -----------------------------
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json(
        { error: "Profile not found" },
        { status: 404 }
      );
    }

    // -----------------------------
    // 4. Check allowed roles
    // -----------------------------
    const allowedRoles = ["instructor", "manager", "admin"] as const;
    type AllowedRole = (typeof allowedRoles)[number];

    if (!allowedRoles.includes(appUser.role as AllowedRole)) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // -----------------------------
    // 5. Validate request body
    // -----------------------------
    const body = await req.json();
    console.log("📥 Received course data:", body);
    
    const parsed = createCourseSchema.safeParse(body);

    if (!parsed.success) {
      console.log("❌ Validation errors:", parsed.error.format());
      return NextResponse.json(
        {
          error: "Invalid data",
          details: parsed.error.format(),
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // -----------------------------
    // 6. Generate unique slug
    // -----------------------------
    const baseSlug = data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");

    const exists = await db
      .select({ slug: courses.slug })
      .from(courses)
      .where(eq(courses.slug, baseSlug))
      .limit(1);

    const slug = exists.length > 0 ? `${baseSlug}-${Date.now()}` : baseSlug;

    // -----------------------------
    // 7. Insert course
    // -----------------------------
    const [newCourse] = await db
      .insert(courses)
      .values({
        title: data.title,
        slug,
        description: data.description,
        shortDescription: data.shortDescription,
        thumbnail: data.thumbnail, // ✅ Now accepts /api/media/... paths
        price: data.price.toFixed(2),
        discountPrice: data.discountPrice?.toFixed(2),
        level: data.level,
        categoryId: data.categoryId || null,
        language: data.language,
        durationHours: data.durationHours ?? 0,
        instructorId: appUser.id,
        requirements: data.requirements,
        learningOutcomes: data.learningOutcomes,
        targetAudience: data.targetAudience,
      })
      .returning();

    console.log("✅ Course created:", newCourse.slug);

    return NextResponse.json(
      {
        success: true,
        message: "Course created successfully!",
        course: {
          id: newCourse.id,
          slug: newCourse.slug,
          title: newCourse.title,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create course error:", error);

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}