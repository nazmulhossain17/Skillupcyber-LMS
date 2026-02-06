// ============================================
// FILE: app/checkout/[slug]/page.tsx
// ============================================

import { notFound, redirect } from 'next/navigation';
import { db } from '@/db/drizzle';
import { courses, categories, app_users, enrollments } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { CheckoutClient } from '@/components/checkout/CheckoutClient';

interface CheckoutPageProps {
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

export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const { slug } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  // Redirect to login if not authenticated
  if (!session?.user?.id) {
    redirect(`/auth/login?redirect=/checkout/${slug}`);
  }

  // Get course details
  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      shortDescription: courses.shortDescription,
      thumbnail: courses.thumbnail,
      price: courses.price,
      discountPrice: courses.discountPrice,
      level: courses.level,
      language: courses.language,
      durationHours: courses.durationHours,
      enrollmentCount: courses.enrollmentCount,
      averageRating: courses.averageRating,
      reviewCount: courses.reviewCount,
      instructorId: courses.instructorId,
      categoryId: courses.categoryId,
      published: courses.published,
    })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  if (!course || !course.published) {
    notFound();
  }

  // Get instructor
  const [instructor] = await db
    .select({
      id: app_users.id,
      name: app_users.name,
      avatar: app_users.avatar,
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

  // Check if already enrolled
  const appUserId = await getAppUserId(session.user.id);
  if (appUserId) {
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

    if (existingEnrollment) {
      // Already enrolled - redirect to learn page
      redirect(`/courses/${slug}/learn`);
    }
  }

  // Transform data
  const courseData = {
    ...course,
    price: Number(course.price),
    discountPrice: course.discountPrice ? Number(course.discountPrice) : null,
    averageRating: course.averageRating ? Number(course.averageRating) : 0,
  };

  return (
    <CheckoutClient
      course={courseData}
      instructor={instructor}
      category={category}
      user={{
        id: session.user.id,
        name: session.user.name || '',
        email: session.user.email || '',
      }}
    />
  );
}