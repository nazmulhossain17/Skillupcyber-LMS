// app/api/instructor/courses/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { app_users, courses, enrollments } from "@/db/schema";
import { eq, count } from "drizzle-orm";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: req.headers });
  
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Find the app_user (UUID) from the Better Auth user (text id)
  const [appUser] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, session.user.id))
    .limit(1);

  if (!appUser) {
    return NextResponse.json({ courses: [] }, { status: 200 });
  }

  const instructorCourses = await db
    .select({
      id: courses.id,
      slug: courses.slug,
      title: courses.title,
      shortDescription: courses.shortDescription,
      thumbnail: courses.thumbnail,
      price: courses.price,
      durationHours: courses.durationHours,
      discountPrice: courses.discountPrice,
      level: courses.level,
      published: courses.published, // ✅ Added published status
      featured: courses.featured, // ✅ Added featured status
      instructorName: app_users.name, // ✅ Added instructor name
      instructorAvatar: app_users.avatar, // ✅ Added instructor avatar
      studentCount: count(enrollments.id),
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt, // ✅ Added updated date
    })
    .from(courses)
    .leftJoin(enrollments, eq(enrollments.courseId, courses.id))
    .leftJoin(app_users, eq(courses.instructorId, app_users.id)) // ✅ Added join for instructor data
    .where(eq(courses.instructorId, appUser.id))
    .groupBy(courses.id, app_users.name, app_users.avatar) // ✅ Added instructor fields to groupBy
    .orderBy(courses.createdAt);

  return NextResponse.json({ courses: instructorCourses });
}