// ============================================
// FILE: app/courses/[slug]/page.tsx
// Updated to fetch free preview lesson data
// ============================================

import { notFound } from 'next/navigation';
import { db } from '@/db/drizzle';
import { 
  courses, 
  categories, 
  app_users, 
  enrollments,
  sections,
  lessons,
  lessonContent,
  reviews
} from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { CourseDetailClient } from '@/components/courses/new/CourseDetailClient';

interface CoursePageProps {
  params: Promise<{ slug: string }>;
}

async function getAppUserId(userId: string) {
  const [user] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);
  return user?.id;
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { slug } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  // Get course with instructor info
  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      description: courses.description,
      shortDescription: courses.shortDescription,
      thumbnail: courses.thumbnail,
      previewVideo: courses.previewVideo,
      price: courses.price,
      discountPrice: courses.discountPrice,
      level: courses.level,
      language: courses.language,
      durationHours: courses.durationHours,
      enrollmentCount: courses.enrollmentCount,
      averageRating: courses.averageRating,
      reviewCount: courses.reviewCount,
      requirements: courses.requirements,
      learningOutcomes: courses.learningOutcomes,
      targetAudience: courses.targetAudience,
      instructorId: courses.instructorId,
      categoryId: courses.categoryId,
      published: courses.published,
      createdAt: courses.createdAt,
      updatedAt: courses.updatedAt,
    })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  if (!course || !course.published) {
    notFound();
  }

  // Get instructor details
  const [instructor] = await db
    .select({
      id: app_users.id,
      name: app_users.name,
      avatar: app_users.avatar,
      bio: app_users.bio,
    })
    .from(app_users)
    .where(eq(app_users.id, course.instructorId))
    .limit(1);

  // Get category
  let category = null;
  if (course.categoryId) {
    const [cat] = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.id, course.categoryId))
      .limit(1);
    category = cat;
  }

  // Get course curriculum (sections with lessons)
  const courseSections = await db
    .select({
      id: sections.id,
      title: sections.title,
      type: sections.type,
      order: sections.order,
    })
    .from(sections)
    .where(eq(sections.courseId, course.id))
    .orderBy(asc(sections.order));

  // Get lessons for each section WITH content data (isFree, videoUrl, duration)
  const curriculum = await Promise.all(
    courseSections.map(async (section) => {
      if (section.type === 'lessons') {
        // ✅ Join with lessonContent to get isFree, videoUrl, durationMinutes
        const sectionLessons = await db
          .select({
            id: lessons.id,
            title: lessons.title,
            order: lessons.order,
            // Content fields for preview
            isFree: lessonContent.isFree,
            videoUrl: lessonContent.videoUrl,
            durationMinutes: lessonContent.durationMinutes,
          })
          .from(lessons)
          .leftJoin(lessonContent, eq(lessons.id, lessonContent.lessonId))
          .where(eq(lessons.sectionId, section.id))
          .orderBy(asc(lessons.order));
        
        return {
          ...section,
          lessons: sectionLessons.map(lesson => ({
            id: lesson.id,
            title: lesson.title,
            order: lesson.order,
            isFree: lesson.isFree ?? false,
            videoUrl: lesson.videoUrl,
            durationMinutes: lesson.durationMinutes ?? 0,
          })),
          lessonCount: sectionLessons.length,
        };
      }
      return {
        ...section,
        lessons: [],
        lessonCount: section.type === 'quiz' ? 1 : section.type === 'assignment' ? 1 : 0,
      };
    })
  );

  // Get total lessons/items count
  const totalLessons = curriculum.reduce((acc, s) => acc + s.lessonCount, 0);

  // Get recent reviews
  const courseReviews = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      comment: reviews.comment,
      createdAt: reviews.createdAt,
      userId: reviews.appUserId,
    })
    .from(reviews)
    .where(and(eq(reviews.courseId, course.id), eq(reviews.isPublished, true)))
    .orderBy(reviews.createdAt)
    .limit(5);

  // Get reviewer names
  const reviewerIds = courseReviews.map(r => r.userId);
  const reviewers = reviewerIds.length > 0
    ? await db
        .select({ id: app_users.id, name: app_users.name, avatar: app_users.avatar })
        .from(app_users)
    : [];
  const reviewerMap = new Map(reviewers.map(r => [r.id, r]));

  const reviewsWithUsers = courseReviews.map(review => ({
    ...review,
    user: reviewerMap.get(review.userId) || { name: 'Anonymous', avatar: null },
  }));

  // Check enrollment status
  let isEnrolled = false;
  let enrollment = null;
  let isInstructor = false;

  if (session?.user?.id) {
    const appUserId = await getAppUserId(session.user.id);
    if (appUserId) {
      isInstructor = course.instructorId === appUserId;
      
      const [existingEnrollment] = await db
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.courseId, course.id),
            eq(enrollments.appUserId, appUserId)
          )
        )
        .limit(1);
      
      isEnrolled = !!existingEnrollment;
      enrollment = existingEnrollment;
    }
  }

  // Transform data - Convert Date to string for updatedAt
  const courseData = {
    ...course,
    price: Number(course.price),
    discountPrice: course.discountPrice ? Number(course.discountPrice) : null,
    averageRating: course.averageRating ? Number(course.averageRating) : 0,
    requirements: course.requirements as string[] || [],
    learningOutcomes: course.learningOutcomes as string[] || [],
    targetAudience: course.targetAudience as string[] || [],
    updatedAt: course.updatedAt ? course.updatedAt.toISOString() : null,
  };

  // Get current user's appUserId for reviews
  let currentAppUserId: string | undefined;
  if (session?.user?.id) {
    const appUserId = await getAppUserId(session.user.id);
    currentAppUserId = appUserId || undefined;
  }

  return (
    <CourseDetailClient
      course={courseData}
      instructor={instructor}
      category={category}
      curriculum={curriculum}
      totalLessons={totalLessons}
      reviews={reviewsWithUsers}
      isEnrolled={isEnrolled}
      isInstructor={isInstructor}
      isLoggedIn={!!session?.user}
      enrollment={enrollment}
      currentUserId={currentAppUserId}
    />
  );
}