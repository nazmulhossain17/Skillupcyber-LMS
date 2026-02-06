// ============================================
// FILE: components/courses/LessonNavigation.tsx
// Navigation component that tracks progress when clicking Next
// ============================================

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Loader2, CheckCircle } from 'lucide-react';

interface NavigationItem {
  id: string;
  type: 'lesson' | 'quiz' | 'assignment';
  slug?: string;
  title: string;
  sectionTitle?: string;
}

interface LessonNavigationProps {
  courseSlug: string;
  currentItemId: string;
  currentItemType: 'lesson' | 'quiz' | 'assignment';
  previousItem: NavigationItem | null;
  nextItem: NavigationItem | null;
  onProgressUpdate?: (progress: { completed: number; total: number; percentage: number }) => void;
}

export function LessonNavigation({
  courseSlug,
  currentItemId,
  currentItemType,
  previousItem,
  nextItem,
  onProgressUpdate,
}: LessonNavigationProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [marking, setMarking] = useState(false);

  // Build URL for navigation item
  const getItemUrl = (item: NavigationItem) => {
    const base = `/courses/${courseSlug}/learn`;
    switch (item.type) {
      case 'lesson':
        return `${base}/video/${item.id}`;
      case 'quiz':
        return `${base}/quiz/${item.id}`;
      case 'assignment':
        return `${base}/assignment/${item.id}`;
      default:
        return `${base}/video/${item.id}`;
    }
  };

  // Mark current lesson as complete
  const markAsComplete = async (): Promise<boolean> => {
    if (currentItemType !== 'lesson') {
      return true; // Skip for non-lessons
    }

    try {
      const res = await fetch(`/api/lessons/${currentItemId}/complete`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        
        // Update progress in parent
        if (onProgressUpdate && data.progress) {
          onProgressUpdate(data.progress);
        }

        if (!data.alreadyCompleted) {
          toast.success('Lesson completed!', {
            icon: <CheckCircle className="h-4 w-4 text-green-500" />,
          });
        }

        return true;
      } else {
        const data = await res.json();
        console.error('Failed to mark complete:', data.error);
        return true; // Still allow navigation
      }
    } catch (error) {
      console.error('Error marking complete:', error);
      return true; // Still allow navigation
    }
  };

  // Handle Previous click
  const handlePrevious = () => {
    if (!previousItem) return;
    setLoading(true);
    router.push(getItemUrl(previousItem));
  };

  // Handle Next click - Mark complete first, then navigate
  const handleNext = async () => {
    if (!nextItem) return;

    setMarking(true);
    
    // Mark current lesson as complete
    await markAsComplete();
    
    setMarking(false);
    setLoading(true);

    // Navigate to next item
    router.push(getItemUrl(nextItem));
  };

  // Handle marking complete without navigating
  const handleMarkComplete = async () => {
    setMarking(true);
    await markAsComplete();
    setMarking(false);
  };

  return (
    <div className="flex items-center justify-between border-t pt-4 mt-6">
      {/* Previous Button */}
      <div className="flex-1">
        {previousItem ? (
          <Button
            variant="outline"
            onClick={handlePrevious}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <ChevronLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Previous</span>
          </Button>
        ) : (
          <div /> // Spacer
        )}
      </div>

      {/* Current Item Info (Center) */}
      {nextItem && (
        <div className="flex-1 text-center hidden md:block">
          <p className="text-sm font-medium text-foreground truncate max-w-xs mx-auto">
            {nextItem.title}
          </p>
          {nextItem.sectionTitle && (
            <p className="text-xs text-muted-foreground">
              {nextItem.sectionTitle}
            </p>
          )}
        </div>
      )}

      {/* Next Button / Mark Complete */}
      <div className="flex-1 flex justify-end gap-2">
        {!nextItem && currentItemType === 'lesson' && (
          <Button
            variant="outline"
            onClick={handleMarkComplete}
            disabled={marking}
            className="flex items-center gap-2"
          >
            {marking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Mark Complete
          </Button>
        )}

        {nextItem && (
          <Button
            onClick={handleNext}
            disabled={loading || marking}
            className="flex items-center gap-2 bg-primary text-white hover:bg-primary/90"
          >
            {marking ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="hidden sm:inline">Completing...</span>
              </>
            ) : (
              <>
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

// ============================================
// Alternative: Floating Navigation Bar
// ============================================

export function FloatingLessonNavigation({
  courseSlug,
  currentItemId,
  currentItemType,
  previousItem,
  nextItem,
  onProgressUpdate,
}: LessonNavigationProps) {
  const router = useRouter();
  const [marking, setMarking] = useState(false);

  const getItemUrl = (item: NavigationItem) => {
    const base = `/courses/${courseSlug}/learn`;
    switch (item.type) {
      case 'lesson':
        return `${base}/video/${item.id}`;
      case 'quiz':
        return `${base}/quiz/${item.id}`;
      case 'assignment':
        return `${base}/assignment/${item.id}`;
      default:
        return `${base}/video/${item.id}`;
    }
  };

  const markAsComplete = async () => {
    if (currentItemType !== 'lesson') return true;

    try {
      const res = await fetch(`/api/lessons/${currentItemId}/complete`, {
        method: 'POST',
      });

      if (res.ok) {
        const data = await res.json();
        if (onProgressUpdate && data.progress) {
          onProgressUpdate(data.progress);
        }
        if (!data.alreadyCompleted) {
          toast.success('Lesson completed!');
        }
      }
      return true;
    } catch (error) {
      console.error('Error:', error);
      return true;
    }
  };

  const handleNext = async () => {
    if (!nextItem) return;
    setMarking(true);
    await markAsComplete();
    setMarking(false);
    router.push(getItemUrl(nextItem));
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur border-t p-4 z-50">
      <div className="max-w-4xl mx-auto flex items-center justify-between">
        {/* Previous */}
        <Button
          variant="ghost"
          onClick={() => previousItem && router.push(getItemUrl(previousItem))}
          disabled={!previousItem}
          className="flex items-center gap-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>

        {/* Next Item Preview */}
        {nextItem && (
          <div className="text-center flex-1 mx-4 hidden sm:block">
            <p className="text-sm text-muted-foreground">Up next:</p>
            <p className="font-medium truncate">{nextItem.title}</p>
          </div>
        )}

        {/* Next / Complete */}
        <Button
          onClick={handleNext}
          disabled={!nextItem || marking}
          className="flex items-center gap-2 bg-primary text-white"
        >
          {marking ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              Next
              <ChevronRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}