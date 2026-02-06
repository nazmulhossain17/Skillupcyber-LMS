// app/api/courses/route.ts
import { NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { courses, user, app_users, categories, sections, lessons, lessonContent, enrollments, reviews } from "@/db/schema";
import { eq, sql, and } from "drizzle-orm";

export async function GET() {
  try {
    // Fetch all published courses with instructor and category info
    const coursesData = await db
      .select({
        id: courses.id,
        title: courses.title,
        slug: courses.slug,
        description: courses.description,
        thumbnail: courses.thumbnail, // Note: your schema uses 'thumbnail' not 'thumbnailUrl'
        price: courses.price,
        level: courses.level,
        categoryId: courses.categoryId,
        instructorId: courses.instructorId,
        published: courses.published, // Note: your schema uses 'published' not 'isPublished'
        createdAt: courses.createdAt,
        enrollmentCount: courses.enrollmentCount,
        averageRating: courses.averageRating,
        reviewCount: courses.reviewCount,
        // Category info
        categoryName: categories.name,
        // Instructor info
        instructorName: user.name,
      })
      .from(courses)
      .leftJoin(categories, eq(courses.categoryId, categories.id))
      .leftJoin(app_users, eq(courses.instructorId, app_users.id))
      .leftJoin(user, eq(app_users.userId, user.id))
      .where(eq(courses.published, true));

    // For each course, get lesson count and total duration
    const coursesWithStats = await Promise.all(
      coursesData.map(async (course) => {
        // Get lesson count and total duration from lessonContent table
        const lessonsData = await db
          .select({
            count: sql<number>`cast(count(*) as integer)`,
            totalDuration: sql<number>`cast(COALESCE(sum(${lessonContent.durationMinutes}), 0) as integer)`,
          })
          .from(lessons)
          .leftJoin(sections, eq(lessons.sectionId, sections.id))
          .leftJoin(lessonContent, eq(lessons.id, lessonContent.lessonId))
          .where(eq(sections.courseId, course.id))
          .then((rows) => rows[0]);

        return {
          id: course.id,
          title: course.title,
          slug: course.slug,
          description: course.description,
          thumbnailUrl: course.thumbnail, // Map to thumbnailUrl for consistency with frontend
          price: Number(course.price),
          level: course.level,
          categoryId: course.categoryId,
          categoryName: course.categoryName,
          instructorId: course.instructorId,
          instructorName: course.instructorName,
          rating: Number(course.averageRating || 0),
          studentCount: Number(course.enrollmentCount || 0),
          lessonCount: Number(lessonsData?.count || 0),
          duration: Number(lessonsData?.totalDuration || 0),
          isPublished: course.published, // Map to isPublished for consistency
          createdAt: course.createdAt?.toISOString() || new Date().toISOString(),
        };
      })
    );

    return NextResponse.json({
      courses: coursesWithStats,
    });
  } catch (error) {
    console.error("Error fetching courses:", error);
    return NextResponse.json(
      { error: "Failed to fetch courses" },
      { status: 500 }
    );
  }
}