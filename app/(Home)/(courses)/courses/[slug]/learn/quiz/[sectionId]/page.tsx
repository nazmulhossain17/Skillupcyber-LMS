// ============================================
// FILE: app/courses/[slug]/learn/quiz/[sectionId]/page.tsx
// ============================================

import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { quizzes } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCourseLearnData } from '@/lib/course-learn-utils';
import { LearnPageWrapper } from '@/components/courses/new/LearnPageWrapper';
import { QuizPlayer } from '@/components/courses/new/QuizPlayer';

interface QuizPageProps {
  params: Promise<{
    slug: string;
    sectionId: string;
  }>;
}

export default async function QuizPage({ params }: QuizPageProps) {
  const { slug, sectionId } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user?.id) {
    redirect(`/course/${slug}`);
  }

  // Pass sectionId as the identifier
  const data = await getCourseLearnData(slug, session.user.id, undefined, sectionId);

  if (!data) {
    redirect(`/course/${slug}`);
  }

  const { currentItem } = data;

  if (!currentItem || currentItem.sectionType !== 'quiz') {
    notFound();
  }

  // Fetch the quiz data for this section
  const [quiz] = await db
    .select({
      id: quizzes.id,
      title: quizzes.title,
      description: quizzes.description,
      passingScore: quizzes.passingScore,
      timeLimit: quizzes.timeLimit,
      maxAttempts: quizzes.maxAttempts,
      questionCount: quizzes.questionCount,
    })
    .from(quizzes)
    .where(eq(quizzes.sectionId, sectionId))
    .limit(1);

  return (
    <LearnPageWrapper
      course={data.course}
      sections={data.sections}
      currentItem={data.currentItem}
      previousItem={data.previousItem}
      nextItem={data.nextItem}
      totalItems={data.totalItems}
      completedItems={data.completedItems}
    >
      <div className="flex-1 overflow-hidden">
        <QuizPlayer
          quiz={quiz ? {
            id: quiz.id,
            title: quiz.title,
            description: quiz.description ?? '',
            passingScore: quiz.passingScore ?? 70,
            timeLimit: quiz.timeLimit,
            maxAttempts: quiz.maxAttempts ?? 3,
            questionCount: quiz.questionCount ?? 0,
          } : null}
          courseSlug={slug}
          sectionTitle={currentItem.sectionTitle}
        />
      </div>
    </LearnPageWrapper>
  );
}