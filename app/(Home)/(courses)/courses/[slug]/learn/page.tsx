// ============================================
// FILE: app/courses/[slug]/learn/page.tsx
// This page redirects to the first lesson/quiz/assignment of the course
// ============================================

import { redirect, notFound } from 'next/navigation';
import { db } from '@/db/drizzle';
import { courses, sections, lessons, enrollments, app_users } from '@/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { BookOpen, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface LearnPageProps {
  params: Promise<{ slug: string }>;
}

export default async function LearnPage({ params }: LearnPageProps) {
  const { slug } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user?.id) {
    redirect(`/course/${slug}`);
  }

  // Get app user
  const [appUser] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, session.user.id))
    .limit(1);

  if (!appUser) {
    redirect(`/course/${slug}`);
  }

  // Get course
  const [course] = await db
    .select({ id: courses.id, title: courses.title })
    .from(courses)
    .where(eq(courses.slug, slug))
    .limit(1);

  if (!course) {
    notFound();
  }

  // Check enrollment
  const [enrollment] = await db
    .select()
    .from(enrollments)
    .where(
      and(
        eq(enrollments.courseId, course.id),
        eq(enrollments.appUserId, appUser.id)
      )
    )
    .limit(1);

  if (!enrollment) {
    redirect(`/course/${slug}`);
  }

  // Get first section
  const [firstSection] = await db
    .select({ id: sections.id, type: sections.type })
    .from(sections)
    .where(eq(sections.courseId, course.id))
    .orderBy(asc(sections.order))
    .limit(1);

  if (!firstSection) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="text-center max-w-sm sm:max-w-md">
          <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-muted flex items-center justify-center mb-4 sm:mb-6">
            <BookOpen className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 text-muted-foreground" />
          </div>
          <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-2">No Content Yet</h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 px-4">
            This course doesn&apos;t have any content yet. Check back later!
          </p>
          <Link 
            href={`/course/${slug}`}
            className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-9 sm:h-10 px-4 py-2 hover:bg-primary/90 transition-colors"
          >
            Back to Course
          </Link>
        </div>
      </div>
    );
  }

  // If first section is 'lessons' type, get the first lesson
  if (firstSection.type === 'lessons') {
    const [firstLesson] = await db
      .select({ id: lessons.id })
      .from(lessons)
      .where(eq(lessons.sectionId, firstSection.id))
      .orderBy(asc(lessons.order))
      .limit(1);

    if (firstLesson) {
      redirect(`/courses/${slug}/learn/video/${firstLesson.id}`);
    }
  }

  // For quiz or assignment sections, redirect to section directly
  if (firstSection.type === 'quiz') {
    redirect(`/courses/${slug}/learn/quiz/${firstSection.id}`);
  }

  if (firstSection.type === 'assignment') {
    redirect(`/courses/${slug}/learn/assignment/${firstSection.id}`);
  }

  // Fallback - no content
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="text-center max-w-sm sm:max-w-md">
        <div className="mx-auto w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center mb-4 sm:mb-6">
          <AlertCircle className="h-7 w-7 sm:h-8 sm:w-8 md:h-10 md:w-10 text-yellow-600 dark:text-yellow-500" />
        </div>
        <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-2">Content Unavailable</h1>
        <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 px-4">
          This course doesn&apos;t have any accessible content at the moment.
        </p>
        <Link 
          href={`/course/${slug}`}
          className="inline-flex items-center justify-center rounded-md text-sm font-medium bg-primary text-primary-foreground h-9 sm:h-10 px-4 py-2 hover:bg-primary/90 transition-colors"
        >
          Back to Course
        </Link>
      </div>
    </div>
  );
}