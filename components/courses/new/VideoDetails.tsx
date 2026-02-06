// ============================================
// FILE: components/courses/new/VideoDetails.tsx
// ============================================

'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Clock, Layers, CheckCircle2, Play, BarChart3 } from 'lucide-react';

interface LessonData {
  id: string;
  title: string;
  sectionTitle: string;
  isCompleted: boolean;
  description?: string | null;
  video?: {
    url: string | null;
    duration: number | null;
    isFree: boolean;
  } | null;
}

interface VideoDetailsProps {
  lesson: LessonData;
}

export function VideoDetails({ lesson }: VideoDetailsProps) {
  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins >= 60) {
      const hrs = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hrs}h ${remainingMins}m`;
    }
    return secs > 0 ? `${mins}m ${secs}s` : `${mins} min`;
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Completion Status */}
      {lesson.isCompleted && (
        <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-900">
          <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <p className="text-sm sm:text-base font-medium text-green-800 dark:text-green-200">
              Lesson Completed
            </p>
            <p className="text-xs sm:text-sm text-green-600 dark:text-green-400">
              Great job! You&apos;ve finished this lesson.
            </p>
          </div>
        </div>
      )}

      {/* Video Info Cards - Responsive Grid */}
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
        {/* Duration Card */}
        <Card className="bg-muted/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                  Duration
                </p>
                <p className="text-sm sm:text-base md:text-lg font-semibold truncate">
                  {formatDuration(lesson.video?.duration ?? null)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Card */}
        <Card className="bg-muted/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Layers className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                  Section
                </p>
                <p className="text-sm sm:text-base font-semibold truncate" title={lesson.sectionTitle}>
                  {lesson.sectionTitle}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Card */}
        <Card className="bg-muted/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center ${
                lesson.isCompleted 
                  ? 'bg-green-500/10' 
                  : 'bg-orange-500/10'
              }`}>
                <BarChart3 className={`h-4 w-4 sm:h-5 sm:w-5 ${
                  lesson.isCompleted 
                    ? 'text-green-500' 
                    : 'text-orange-500'
                }`} />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                  Status
                </p>
                <p className={`text-sm sm:text-base font-semibold ${
                  lesson.isCompleted 
                    ? 'text-green-600 dark:text-green-400' 
                    : 'text-orange-600 dark:text-orange-400'
                }`}>
                  {lesson.isCompleted ? 'Completed' : 'In Progress'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Type Card */}
        <Card className="bg-muted/50">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex-shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <Play className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] sm:text-xs text-muted-foreground uppercase tracking-wide">
                  Type
                </p>
                <p className="text-sm sm:text-base font-semibold">
                  Video Lesson
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      <Card>
        <CardContent className="p-3 sm:p-4 md:p-6">
          <h3 className="text-sm sm:text-base font-semibold mb-2 sm:mb-3">
            About this lesson
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
            {lesson.description || (
              <>
                Watch this video to learn about <span className="font-medium text-foreground">{lesson.title.toLowerCase()}</span>. 
                Make sure to watch the entire video to mark it as complete and track your progress.
              </>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Tips Card - Mobile Optimized */}
      <Card className="border-dashed">
        <CardContent className="p-3 sm:p-4">
          <h4 className="text-xs sm:text-sm font-medium mb-2 text-muted-foreground">
            💡 Learning Tips
          </h4>
          <ul className="text-xs sm:text-sm text-muted-foreground space-y-1.5 sm:space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Take notes while watching for better retention</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Pause and practice concepts as you learn</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>Use the Q&A tab to ask questions</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}