// ============================================
// FILE: lib/course-learn-utils.ts
// ============================================

import { db } from '@/db/drizzle';
import { 
  courses, 
  sections,       
  lessons,         
  lessonContent, 
  quizzes, 
  assignments,
  quizQuestions,
  enrollments,
  app_users,
  lessonProgress 
} from '@/db/schema';
import { eq, and, asc, count } from 'drizzle-orm';

// ========================================
// TYPES
// ========================================

export interface LessonData {
  id: string;
  title: string;
  slug: string;
  order: number;
  sectionId: string;
  sectionTitle: string;
  sectionOrder: number;
  sectionType: 'lessons' | 'quiz' | 'assignment';
  isCompleted: boolean;
  // For video lessons
  video?: {
    url: string | null;
    playbackId: string | null;
    duration: number | null;
    isFree: boolean;
  } | null;
  // For quiz sections
  quiz?: {
    id: string;
    title: string;
    description: string | null;
    passingScore: number;
    timeLimit: number | null;
    maxAttempts: number | null;
    questionCount: number;
  } | null;
  // For assignment sections
  assignment?: {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    dueDate: Date | null;
    maxScore: number;
  } | null;
}

export interface SectionData {
  id: string;
  title: string;
  description: string | null;
  type: 'lessons' | 'quiz' | 'assignment';
  order: number;
  lessons: LessonData[];
  completedCount: number;
  totalCount: number;
  // For quiz/assignment sections (direct content)
  quiz?: {
    id: string;
    title: string;
    description: string | null;
    passingScore: number;
    timeLimit: number | null;
    maxAttempts: number | null;
    questionCount: number;
  } | null;
  assignment?: {
    id: string;
    title: string;
    description: string | null;
    instructions: string | null;
    dueDate: Date | null;
    maxScore: number;
  } | null;
}

export interface CourseLearnData {
  course: {
    id: string;
    title: string;
    slug: string;
    thumbnail: string | null;
  };
  sections: SectionData[];
  allLessons: LessonData[];
  totalItems: number;
  completedItems: number;
  currentItem: LessonData | null;
  previousItem: LessonData | null;
  nextItem: LessonData | null;
}

// ========================================
// MAIN FUNCTION
// ========================================

export async function getCourseLearnData(
  courseSlug: string,
  userId: string,
  currentLessonId?: string,
  currentSectionId?: string,
  contentType?: 'video' | 'quiz' | 'assignment'
): Promise<CourseLearnData | null> {
  // Get app user
  const [appUser] = await db
    .select({ id: app_users.id })
    .from(app_users)
    .where(eq(app_users.userId, userId))
    .limit(1);

  if (!appUser) return null;

  // Get course
  const [course] = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      thumbnail: courses.thumbnail,
    })
    .from(courses)
    .where(eq(courses.slug, courseSlug))
    .limit(1);

  if (!course) return null;

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

  if (!enrollment) return null;

  // Get progress records
  const progressRecords = await db
    .select({
      lessonId: lessonProgress.lessonId,
      completed: lessonProgress.completed,
    })
    .from(lessonProgress)
    .where(eq(lessonProgress.appUserId, appUser.id));

  const completedLessonIds = new Set(
    progressRecords.filter(p => p.completed).map(p => p.lessonId)
  );

  // Get all sections (these are your modules/chapters)
  const courseSections = await db
    .select({
      id: sections.id,
      title: sections.title,
      description: sections.description,
      type: sections.type,
      order: sections.order,
    })
    .from(sections)
    .where(eq(sections.courseId, course.id))
    .orderBy(asc(sections.order));

  // Build sections with content
  const sectionsData: SectionData[] = [];
  const allLessons: LessonData[] = [];

  for (const section of courseSections) {
    const sectionType = section.type as 'lessons' | 'quiz' | 'assignment';
    
    if (sectionType === 'lessons') {
      // Get lessons for this section
      const sectionLessons = await db
        .select({
          id: lessons.id,
          title: lessons.title,
          slug: lessons.slug,
          order: lessons.order,
        })
        .from(lessons)
        .where(eq(lessons.sectionId, section.id))
        .orderBy(asc(lessons.order));

      const lessonDataList: LessonData[] = [];

      for (const lesson of sectionLessons) {
        // Get lesson content (video info)
        const [content] = await db
          .select({
            videoUrl: lessonContent.videoUrl,
            videoPlaybackId: lessonContent.videoPlaybackId,
            durationMinutes: lessonContent.durationMinutes,
            isFree: lessonContent.isFree,
          })
          .from(lessonContent)
          .where(eq(lessonContent.lessonId, lesson.id))
          .limit(1);

        const lessonData: LessonData = {
          id: lesson.id,
          title: lesson.title,
          slug: lesson.slug,
          order: lesson.order,
          sectionId: section.id,
          sectionTitle: section.title,
          sectionOrder: section.order,
          sectionType: 'lessons',
          isCompleted: completedLessonIds.has(lesson.id),
          video: content ? {
            url: content.videoUrl,
            playbackId: content.videoPlaybackId,
            duration: content.durationMinutes ? content.durationMinutes * 60 : null,
            isFree: content.isFree,
          } : null,
        };

        lessonDataList.push(lessonData);
        allLessons.push(lessonData);
      }

      sectionsData.push({
        id: section.id,
        title: section.title,
        description: section.description,
        type: 'lessons',
        order: section.order,
        lessons: lessonDataList,
        completedCount: lessonDataList.filter(l => l.isCompleted).length,
        totalCount: lessonDataList.length,
      });

    } else if (sectionType === 'quiz') {
      // Get quiz for this section
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
        .where(eq(quizzes.sectionId, section.id))
        .limit(1);

      let questionCount = quiz?.questionCount || 0;
      
      // Get actual question count if quiz exists
      if (quiz) {
        const [qCount] = await db
          .select({ count: count() })
          .from(quizQuestions)
          .where(eq(quizQuestions.quizId, quiz.id));
        questionCount = Number(qCount?.count) || questionCount;
      }

      // Create a virtual "lesson" for the quiz section
      const quizLesson: LessonData = {
        id: section.id,
        title: quiz?.title || section.title,
        slug: section.id,
        order: 0,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionOrder: section.order,
        sectionType: 'quiz',
        isCompleted: false,
        quiz: quiz ? {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          passingScore: quiz.passingScore,
          timeLimit: quiz.timeLimit,
          maxAttempts: quiz.maxAttempts,
          questionCount,
        } : null,
      };

      allLessons.push(quizLesson);

      sectionsData.push({
        id: section.id,
        title: section.title,
        description: section.description,
        type: 'quiz',
        order: section.order,
        lessons: [quizLesson],
        completedCount: 0,
        totalCount: 1,
        quiz: quiz ? {
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          passingScore: quiz.passingScore,
          timeLimit: quiz.timeLimit,
          maxAttempts: quiz.maxAttempts,
          questionCount,
        } : null,
      });

    } else if (sectionType === 'assignment') {
      // Get assignment for this section
      const [assignment] = await db
        .select({
          id: assignments.id,
          title: assignments.title,
          description: assignments.description,
          instructions: assignments.instructions,
          dueDate: assignments.dueDate,
          maxScore: assignments.maxScore,
        })
        .from(assignments)
        .where(eq(assignments.sectionId, section.id))
        .limit(1);

      // Create a virtual "lesson" for the assignment section
      const assignmentLesson: LessonData = {
        id: section.id,
        title: assignment?.title || section.title,
        slug: section.id,
        order: 0,
        sectionId: section.id,
        sectionTitle: section.title,
        sectionOrder: section.order,
        sectionType: 'assignment',
        isCompleted: false,
        assignment: assignment ? {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          instructions: assignment.instructions,
          dueDate: assignment.dueDate,
          maxScore: assignment.maxScore,
        } : null,
      };

      allLessons.push(assignmentLesson);

      sectionsData.push({
        id: section.id,
        title: section.title,
        description: section.description,
        type: 'assignment',
        order: section.order,
        lessons: [assignmentLesson],
        completedCount: 0,
        totalCount: 1,
        assignment: assignment ? {
          id: assignment.id,
          title: assignment.title,
          description: assignment.description,
          instructions: assignment.instructions,
          dueDate: assignment.dueDate,
          maxScore: assignment.maxScore,
        } : null,
      });
    }
  }

  // Find current, previous, next items
  let currentItem: LessonData | null = null;
  let previousItem: LessonData | null = null;
  let nextItem: LessonData | null = null;

  const searchId = currentLessonId || currentSectionId;
  
  if (searchId) {
    const currentIndex = allLessons.findIndex(l => 
      l.id === searchId || l.sectionId === searchId
    );
    
    if (currentIndex !== -1) {
      currentItem = allLessons[currentIndex];
      previousItem = currentIndex > 0 ? allLessons[currentIndex - 1] : null;
      nextItem = currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;
    }
  }

  return {
    course,
    sections: sectionsData,
    allLessons,
    totalItems: allLessons.length,
    completedItems: allLessons.filter(l => l.isCompleted).length,
    currentItem,
    previousItem,
    nextItem,
  };
}

// ========================================
// URL HELPERS
// ========================================

export function getItemUrl(courseSlug: string, item: LessonData): string {
  if (item.sectionType === 'quiz') {
    return `/courses/${courseSlug}/learn/quiz/${item.sectionId}`;
  } else if (item.sectionType === 'assignment') {
    return `/courses/${courseSlug}/learn/assignment/${item.sectionId}`;
  } else {
    return `/courses/${courseSlug}/learn/video/${item.id}`;
  }
}

export function getFirstItemUrl(courseSlug: string, sections: SectionData[]): string | null {
  for (const section of sections) {
    if (section.lessons.length > 0) {
      return getItemUrl(courseSlug, section.lessons[0]);
    }
  }
  return null;
}