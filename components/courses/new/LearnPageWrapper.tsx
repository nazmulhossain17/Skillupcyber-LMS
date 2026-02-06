'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Play,
  FileText,
  ClipboardList,
  CheckCircle2,
  Circle,
  Menu,
  X,
  Home,
  Maximize2,
  Minimize2,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Types matching the schema
interface LessonData {
  id: string;
  title: string;
  slug: string;
  order: number;
  sectionId: string;
  sectionTitle: string;
  sectionOrder: number;
  sectionType: 'lessons' | 'quiz' | 'assignment';
  isCompleted: boolean;
  video?: {
    url: string | null;
    playbackId: string | null;
    duration: number | null;
    isFree: boolean;
  } | null;
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

interface SectionData {
  id: string;
  title: string;
  description: string | null;
  type: 'lessons' | 'quiz' | 'assignment';
  order: number;
  lessons: LessonData[];
  completedCount: number;
  totalCount: number;
}

interface CourseData {
  id: string;
  title: string;
  slug: string;
  thumbnail: string | null;
}

interface LearnPageWrapperProps {
  course: CourseData;
  sections: SectionData[];
  currentItem: LessonData | null;
  previousItem: LessonData | null;
  nextItem: LessonData | null;
  totalItems: number;
  completedItems: number;
  children: React.ReactNode;
}

export function LearnPageWrapper({
  course,
  sections,
  currentItem,
  previousItem,
  nextItem,
  totalItems,
  completedItems,
  children,
}: LearnPageWrapperProps) {
  const router = useRouter();
  
  // ✅ Initialize sidebar closed (will open on desktop after mount)
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theatreMode, setTheatreMode] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isCompleting, setIsCompleting] = useState(false);
  const [isMobile, setIsMobile] = useState(true); // Default to mobile to prevent flash

  // ✅ Detect screen size and set sidebar state accordingly
  useEffect(() => {
    const checkScreenSize = () => {
      const isSmallScreen = window.innerWidth < 1024; // lg breakpoint
      setIsMobile(isSmallScreen);
    };

    // Check on mount
    checkScreenSize();
    
    // Only auto-open sidebar on desktop on initial load
    if (window.innerWidth >= 1024) {
      setSidebarOpen(true);
    }

    // Listen for resize
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Expand current section by default
  useEffect(() => {
    if (currentItem?.sectionId) {
      setExpandedSections(prev => new Set([...prev, currentItem.sectionId]));
    }
  }, [currentItem?.sectionId]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

  const getItemUrl = (item: LessonData) => {
    if (item.sectionType === 'quiz') {
      return `/courses/${course.slug}/learn/quiz/${item.sectionId}`;
    } else if (item.sectionType === 'assignment') {
      return `/courses/${course.slug}/learn/assignment/${item.sectionId}`;
    } else {
      return `/courses/${course.slug}/learn/video/${item.id}`;
    }
  };

  const getIcon = (type: string, isCompleted: boolean, isCurrent: boolean) => {
    if (isCompleted) {
      return <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />;
    }
    
    const iconClass = cn("h-4 w-4 shrink-0", isCurrent ? "text-primary" : "text-muted-foreground");
    
    switch (type) {
      case 'lessons':
        return <Play className={iconClass} />;
      case 'quiz':
        return <ClipboardList className={iconClass} />;
      case 'assignment':
        return <FileText className={iconClass} />;
      default:
        return <Circle className={iconClass} />;
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const progressPercent = totalItems > 0 
    ? Math.round((completedItems / totalItems) * 100) 
    : 0;

  const handlePrevious = () => {
    if (previousItem) {
      router.push(getItemUrl(previousItem));
    }
  };

  const markLessonComplete = async (lessonId: string): Promise<boolean> => {
    try {
      const response = await fetch(`/api/courses/${course.slug}/lessons/${lessonId}/complete`, {
        method: 'POST',
      });
      
      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to mark lesson complete:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error marking lesson complete:', error);
      return false;
    }
  };

  const handleNext = async () => {
    if (!currentItem || !nextItem) return;
    
    setIsCompleting(true);
    
    try {
      // Only mark video lessons as complete (quizzes/assignments have their own completion logic)
      if (currentItem.sectionType === 'lessons' && !currentItem.isCompleted) {
        await markLessonComplete(currentItem.id);
      }
      
      // Navigate to next item regardless of completion result
      router.push(getItemUrl(nextItem));
    } finally {
      setIsCompleting(false);
    }
  };

  // Mark complete and stay on current page (for manual completion)
  const handleMarkComplete = async () => {
    if (!currentItem || currentItem.isCompleted) return;
    
    setIsCompleting(true);
    
    try {
      const success = await markLessonComplete(currentItem.id);
      if (success) {
        router.refresh(); // Refresh to update UI with new completion status
      }
    } finally {
      setIsCompleting(false);
    }
  };

  // ✅ Close sidebar when navigating on mobile
  const handleItemClick = () => {
    if (isMobile) {
      setSidebarOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <header className="h-12 sm:h-14 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 sticky top-0 z-50 flex items-center px-2 sm:px-4 gap-2 sm:gap-4">
        {/* Left: Menu toggle and course title */}
        <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0 h-8 w-8 sm:h-9 sm:w-9"
          >
            {sidebarOpen ? <X className="h-4 w-4 sm:h-5 sm:w-5" /> : <Menu className="h-4 w-4 sm:h-5 sm:w-5" />}
          </Button>
          
          <Link 
            href={`/my-courses`}
            className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <Home className="h-4 w-4" />
            <span className="hidden sm:inline text-sm">Back to Course</span>
          </Link>

          <div className="h-4 w-px bg-border hidden sm:block" />

          <h1 className="font-semibold text-xs sm:text-sm truncate hidden md:block max-w-[200px] lg:max-w-[300px]">
            {course.title}
          </h1>
        </div>

        {/* Center: Progress */}
        <div className="flex items-center gap-2 sm:gap-3 justify-center">
          <span className="font-medium text-xs sm:text-sm text-foreground">{progressPercent}%</span>
          <Progress value={progressPercent} className="w-16 sm:w-24 lg:w-32 h-1.5 sm:h-2" />
          <span className="text-[10px] sm:text-xs text-muted-foreground hidden sm:inline">
            {completedItems}/{totalItems}
          </span>
        </div>

        {/* Right: Theatre mode and mark complete */}
        <div className="flex items-center gap-1 sm:gap-2 flex-1 justify-end">
          {currentItem && currentItem.sectionType === 'lessons' && !currentItem.isCompleted && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkComplete}
              disabled={isCompleting}
              className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm hidden sm:flex"
            >
              {isCompleting ? (
                <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4" />
              )}
              <span className="hidden md:inline">Mark Complete</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTheatreMode(!theatreMode)}
            className="gap-1 sm:gap-2 h-8 sm:h-9 px-2 sm:px-3 hidden md:flex"
          >
            {theatreMode ? (
              <>
                <Minimize2 className="h-4 w-4" />
                <span className="hidden lg:inline text-xs sm:text-sm">Exit Theatre</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-4 w-4" />
                <span className="hidden lg:inline text-xs sm:text-sm">Theatre</span>
              </>
            )}
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* ✅ Mobile overlay when sidebar is open */}
        {sidebarOpen && isMobile && (
          <div 
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside 
          className={cn(
            "bg-background transition-all duration-300 flex flex-col z-40",
            // ✅ Mobile: Fixed overlay sidebar
            "fixed lg:relative inset-y-0 left-0 lg:inset-auto",
            "top-12 sm:top-14 lg:top-0", // Account for header height
            sidebarOpen ? "w-72 sm:w-80 border-r shadow-lg lg:shadow-none" : "w-0",
            theatreMode && "lg:hidden"
          )}
        >
          {sidebarOpen && (
            <>
              {/* Sidebar Header */}
              <div className="p-3 sm:p-4 border-b">
                <h2 className="font-semibold text-sm sm:text-base">Course Content</h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                  {sections.length} sections • {totalItems} lessons
                </p>
              </div>

              {/* Sections List */}
              <ScrollArea className="flex-1">
                <div className="p-2">
                  {sections.map((section) => (
                    <div key={section.id} className="mb-2">
                      {/* Section Header */}
                      <button
                        onClick={() => toggleSection(section.id)}
                        className="w-full flex items-center gap-2 p-2 sm:p-3 rounded-lg hover:bg-muted transition-colors text-left"
                      >
                        <ChevronDown 
                          className={cn(
                            "h-4 w-4 shrink-0 transition-transform",
                            !expandedSections.has(section.id) && "-rotate-90"
                          )} 
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-xs sm:text-sm truncate">{section.title}</p>
                          <p className="text-[10px] sm:text-xs text-muted-foreground">
                            {section.completedCount}/{section.totalCount} • {section.type}
                          </p>
                        </div>
                      </button>

                      {/* Lessons List */}
                      {expandedSections.has(section.id) && (
                        <div className="ml-3 sm:ml-4 pl-2 border-l">
                          {section.lessons.map((lesson) => {
                            const isCurrent = currentItem?.id === lesson.id;
                            
                            return (
                              <Link
                                key={lesson.id}
                                href={getItemUrl(lesson)}
                                onClick={handleItemClick}
                                className={cn(
                                  "flex items-center gap-2 sm:gap-3 p-1.5 sm:p-2 rounded-md transition-colors text-xs sm:text-sm",
                                  isCurrent 
                                    ? "bg-primary/10 text-primary" 
                                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                                )}
                              >
                                {getIcon(lesson.sectionType, lesson.isCompleted, isCurrent)}
                                <span className="flex-1 truncate">{lesson.title}</span>
                                {lesson.video?.duration && (
                                  <span className="text-[10px] sm:text-xs text-muted-foreground">
                                    {formatDuration(lesson.video.duration)}
                                  </span>
                                )}
                              </Link>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Content Area */}
          <div className="flex-1 overflow-auto">
            {children}
          </div>

          {/* Bottom Navigation */}
          <footer className="h-12 sm:h-14 lg:h-16 border-t bg-background flex items-center justify-between px-2 sm:px-4">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={!previousItem}
              className="gap-1 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-4"
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            {/* Current Item Info */}
            <div className="text-center hidden md:block flex-1 min-w-0 px-4">
              {currentItem && (
                <>
                  <p className="text-xs sm:text-sm font-medium truncate max-w-[300px] mx-auto">
                    {currentItem.title}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {currentItem.sectionTitle}
                  </p>
                </>
              )}
            </div>

            <Button
              onClick={handleNext}
              disabled={!nextItem || isCompleting}
              className="gap-1 sm:gap-2 h-8 sm:h-9 text-xs sm:text-sm px-2 sm:px-4"
            >
              {isCompleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </footer>
        </main>
      </div>
    </div>
  );
}