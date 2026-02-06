// ============================================
// FILE: app/courses/[slug]/learn/video/[lessonId]/page.tsx
// ============================================
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/db/drizzle';
import { app_users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { getCourseLearnData } from '@/lib/course-learn-utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LearnPageWrapper } from '@/components/courses/new/LearnPageWrapper';
import { VideoPlayer } from '@/components/courses/new/VideoPlayer';
import { VideoDetails } from '@/components/courses/new/VideoDetails';
import { LessonResources } from '@/components/courses/new/LessonResources';
import { MessageSquare, FileText, BookOpen, Info } from 'lucide-react';
import { CourseDiscussions } from '@/components/courses/new/CourseDiscussions';

interface VideoPageProps {
  params: Promise<{ 
    slug: string;
    lessonId: string;
  }>;
}

export default async function VideoPage({ params }: VideoPageProps) {
  const { slug, lessonId } = await params;
  const headersList = await headers();
  const session = await auth.api.getSession({ headers: headersList });

  if (!session?.user?.id) {
    redirect(`/course/${slug}`);
  }

  // Fetch app_user for discussions
  const [appUser] = await db
    .select({
      id: app_users.id,
      role: app_users.role,
    })
    .from(app_users)
    .where(eq(app_users.userId, session.user.id))
    .limit(1);

  const data = await getCourseLearnData(slug, session.user.id, lessonId);

  if (!data) {
    redirect(`/course/${slug}`);
  }

  const { currentItem } = data;

  if (!currentItem || currentItem.sectionType !== 'lessons') {
    notFound();
  }

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
      <div className="flex flex-col h-full">
        {/* Video Player - Full width on all screens */}
        <div className="bg-black aspect-video w-full flex-shrink-0">
          {currentItem.video?.url ? (
            <VideoPlayer
              videoUrl={currentItem.video.url}
              playbackId={currentItem.video.playbackId}
              lessonId={lessonId}
              courseSlug={slug}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white">
              <p className="text-sm sm:text-base">Video not available</p>
            </div>
          )}
        </div>

        {/* Video Info & Tabs - Responsive padding */}
        <div className="flex-1 p-3 sm:p-4 md:p-6 overflow-y-auto">
          {/* Title Section */}
          <div className="mb-3 sm:mb-4">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold line-clamp-2">
              {currentItem.title}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {currentItem.sectionTitle}
            </p>
          </div>

          {/* Tabs - Responsive */}
          <Tabs defaultValue="overview" className="w-full">
            {/* Mobile: Scrollable tabs, Desktop: Full tabs */}
            <TabsList className="w-full justify-start overflow-x-auto flex-nowrap h-auto p-1 no-scrollbar">
              <TabsTrigger 
                value="overview" 
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap"
              >
                <Info className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="notes" 
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap"
              >
                <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Notes</span>
              </TabsTrigger>
              <TabsTrigger 
                value="resources" 
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap"
              >
                <BookOpen className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Resources</span>
              </TabsTrigger>
              <TabsTrigger 
                value="discussions" 
                className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap"
              >
                <MessageSquare className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>Q&A</span>
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="overview" className="mt-3 sm:mt-4">
              <VideoDetails lesson={currentItem} />
            </TabsContent>
            
            <TabsContent value="notes" className="mt-3 sm:mt-4">
              <div className="bg-muted/50 rounded-lg p-4 sm:p-6 text-center">
                <FileText className="h-8 w-8 sm:h-10 sm:w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm sm:text-base text-muted-foreground">
                  Notes feature coming soon...
                </p>
              </div>
            </TabsContent>
            
            <TabsContent value="resources" className="mt-3 sm:mt-4">
              <LessonResources
                lessonId={lessonId}
                courseSlug={slug}
              />
            </TabsContent>

            <TabsContent value="discussions" className="mt-3 sm:mt-4">
              <CourseDiscussions
                courseId={data.course.id}
                lessonId={lessonId}
                currentUserId={appUser?.id}
                currentUserRole={appUser?.role}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </LearnPageWrapper>
  );
}