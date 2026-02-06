// ============================================
// FILE: app/courses/[slug]/learn/assignment/[sectionId]/page.tsx
// ============================================

import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { assignments } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCourseLearnData } from '@/lib/course-learn-utils';
import { LearnPageWrapper } from '@/components/courses/new/LearnPageWrapper';
import { AssignmentPlayer } from '@/components/courses/new/AssignmentPlayer';

interface AssignmentPageProps {
  params: Promise<{
    slug: string;
    sectionId: string;
  }>;
}

export default async function AssignmentPage({ params }: AssignmentPageProps) {
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

  if (!currentItem || currentItem.sectionType !== 'assignment') {
    notFound();
  }

  // Fetch the assignment data for this section
  const [assignment] = await db
    .select({
      id: assignments.id,
      title: assignments.title,
      instructions: assignments.instructions,
      dueDate: assignments.dueDate,
      maxScore: assignments.maxScore,
    })
    .from(assignments)
    .where(eq(assignments.sectionId, sectionId))
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
        <AssignmentPlayer
          assignment={assignment ? {
            id: assignment.id,
            title: assignment.title,
            instructions: assignment.instructions,
            dueDate: assignment.dueDate,
            maxScore: assignment.maxScore ?? 100,
          } : null}
          courseSlug={slug}
          sectionTitle={currentItem.sectionTitle}
        />
      </div>
    </LearnPageWrapper>
  );
}