// ============================================
// FILE: components/courses/CoursePreviewModal.tsx
// Udemy-style video preview modal with custom color variables
// ✅ Fixed: Shows actual video duration instead of hardcoded values
// ============================================

'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  Loader2,
  X,
  PlayCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

// ✅ Helper function to convert S3 URLs to secure proxy URLs
function getSecureUrl(url: string | null | undefined): string {
  if (!url) return '';
  url = url.trim();
  
  if (url.startsWith('/api/media/') || url.startsWith('/api/files/')) return url;
  if (url.startsWith('/images/') || url.startsWith('/assets/')) return url;
  
  const s3Pattern1 = /https?:\/\/([^.]+)\.s3\.([^.]+)\.amazonaws\.com\/(.+)/;
  const match1 = url.match(s3Pattern1);
  if (match1) return `/api/files/${match1[3]}`;
  
  const s3Pattern2 = /https?:\/\/s3\.([^.]+)\.amazonaws\.com\/([^/]+)\/(.+)/;
  const match2 = url.match(s3Pattern2);
  if (match2) return `/api/files/${match2[3]}`;
  
  const s3Pattern3 = /https?:\/\/([^.]+)\.s3\.amazonaws\.com\/(.+)/;
  const match3 = url.match(s3Pattern3);
  if (match3) return `/api/files/${match3[2]}`;
  
  if (!url.startsWith('http') && !url.startsWith('/')) return `/api/files/${url}`;
  
  return url;
}

interface PreviewLesson {
  id: string;
  title: string;
  videoUrl: string | null;
  durationMinutes: number;
  thumbnail?: string | null;
  order: number;
  sectionTitle?: string;
}

interface CoursePreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  courseTitle: string;
  courseThumbnail: string | null;
  previewLessons: PreviewLesson[];
  previewVideo?: string | null;
}

export function CoursePreviewModal({
  open,
  onOpenChange,
  courseTitle,
  courseThumbnail,
  previewLessons,
  previewVideo,
}: CoursePreviewModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [selectedLesson, setSelectedLesson] = useState<PreviewLesson | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // ✅ Track actual video durations detected from video metadata
  const [videoDurations, setVideoDurations] = useState<Record<string, number>>({});

  const currentVideoUrl = selectedLesson?.videoUrl 
    ? getSecureUrl(selectedLesson.videoUrl)
    : previewVideo 
      ? getSecureUrl(previewVideo)
      : null;

  // ✅ Load video durations for all preview lessons on mount
  useEffect(() => {
    if (!open || previewLessons.length === 0) return;
    
    previewLessons.forEach((lesson) => {
      if (!lesson.videoUrl || videoDurations[lesson.id]) return;
      
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.src = getSecureUrl(lesson.videoUrl);
      
      video.onloadedmetadata = () => {
        setVideoDurations(prev => ({
          ...prev,
          [lesson.id]: video.duration
        }));
        video.remove();
      };
      
      video.onerror = () => {
        video.remove();
      };
    });
  }, [open, previewLessons]);

  useEffect(() => {
    if (open) {
      if (previewLessons.length > 0) {
        setSelectedLesson(previewLessons[0]);
      } else {
        setSelectedLesson(null);
      }
      setIsPlaying(false);
      setError(null);
    }
  }, [open, previewLessons]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
      setError(null);
      
      // ✅ Update duration for current lesson
      if (selectedLesson) {
        setVideoDurations(prev => ({
          ...prev,
          [selectedLesson.id]: video.duration
        }));
      }
    };
    
    const handleLoadedData = () => {
      setIsLoading(false);
      setError(null);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
      if (video.currentTime > 0) {
        setIsLoading(false);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      if (selectedLesson) {
        const currentIndex = previewLessons.findIndex(l => l.id === selectedLesson.id);
        if (currentIndex < previewLessons.length - 1) {
          setSelectedLesson(previewLessons[currentIndex + 1]);
        }
      }
    };

    const handleWaiting = () => setIsLoading(true);
    
    const handleCanPlay = () => {
      setIsLoading(false);
      setError(null);
    };
    
    const handleCanPlayThrough = () => {
      setIsLoading(false);
      setError(null);
    };
    
    const handlePlaying = () => {
      setIsLoading(false);
      setIsPlaying(true);
      setError(null);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
    };
    
    const handleError = () => {
      setError('Failed to load video. Please try again.');
      setIsLoading(false);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [selectedLesson, previewLessons]);

  // Reset when lesson changes
  useEffect(() => {
    const video = videoRef.current;
    setError(null);
    setCurrentTime(0);
    setIsPlaying(false);
    
    if (video && currentVideoUrl) {
      if (video.readyState >= 3) {
        setIsLoading(false);
      } else {
        setIsLoading(true);
      }
    } else {
      setIsLoading(true);
    }
  }, [selectedLesson, currentVideoUrl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video || error) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => {
          setIsPlaying(true);
          setIsLoading(false);
        })
        .catch(() => setError('Failed to play video'));
    }
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = value[0];
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    
    if (isMuted) {
      video.volume = volume || 1;
      setIsMuted(false);
    } else {
      video.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      video.requestFullscreen();
    }
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  // ✅ Format seconds to MM:SS or HH:MM:SS
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // ✅ Get display duration for a lesson - prefer actual video duration, fallback to durationMinutes
  const getLessonDuration = (lesson: PreviewLesson): string => {
    // First, try to use actual detected duration (in seconds)
    const actualDuration = videoDurations[lesson.id];
    if (actualDuration && actualDuration > 0) {
      return formatTime(actualDuration);
    }
    
    // Fallback to durationMinutes from database (convert minutes to seconds for formatting)
    if (lesson.durationMinutes && lesson.durationMinutes > 0) {
      return formatTime(lesson.durationMinutes * 60);
    }
    
    // No duration available
    return '--:--';
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    setError(null);
    setIsLoading(true);
    video.load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden max-h-[90vh] bg-white dark:bg-dark-2 border-stroke dark:border-stroke-dark shadow-2xl">
        {/* Header */}
        <div className="p-4 pb-3 border-b border-stroke dark:border-stroke-dark bg-gray dark:bg-dark">
          <div className="flex items-center justify-between">
            <div className="pr-10">
              <p className="text-xs text-dark-5 dark:text-dark-6 uppercase tracking-wider font-semibold">
                Course Preview
              </p>
              <DialogTitle className="text-lg font-bold text-dark dark:text-white line-clamp-1 mt-0.5">
                {courseTitle}
              </DialogTitle>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="absolute right-3 top-3 h-8 w-8 rounded-full text-dark-5 dark:text-dark-6 hover:bg-white dark:hover:bg-dark-3 hover:text-dark dark:hover:text-white transition-colors"
            >
            </Button>
          </div>
        </div>

        {/* Video Player */}
        <div 
          className="relative aspect-video bg-black"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => isPlaying && setShowControls(false)}
        >
          {currentVideoUrl ? (
            <>
              <video
                ref={videoRef}
                src={currentVideoUrl}
                className="w-full h-full"
                onClick={togglePlay}
                playsInline
                preload="metadata"
              />

              {/* Loading */}
              {isLoading && !error && !isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                  <Loader2 className="h-14 w-14 animate-spin text-primary" />
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/85">
                  <div className="text-center p-6">
                    <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red" />
                    <p className="text-white text-base mb-5">{error}</p>
                    <Button
                      onClick={handleRetry}
                      className="bg-primary hover:bg-primary/90 text-white px-6"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Retry
                    </Button>
                  </div>
                </div>
              )}

              {/* Play overlay when paused */}
              {!isPlaying && !isLoading && !error && (
                <button
                  onClick={togglePlay}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 transition-colors hover:bg-black/50"
                >
                  <div className="w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-xl hover:scale-110 transition-transform">
                    <Play className="h-10 w-10 text-white ml-1" />
                  </div>
                </button>
              )}

              {/* Controls */}
              {!error && (
                <div 
                  className={cn(
                    "absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 pt-16 transition-opacity duration-300",
                    showControls ? "opacity-100" : "opacity-0 pointer-events-none"
                  )}
                >
                  {/* Progress Bar */}
                  <div className="mb-3 group">
                    <Slider
                      value={[currentTime]}
                      max={duration || 100}
                      step={0.1}
                      onValueChange={handleSeek}
                      className="cursor-pointer h-1.5 group-hover:h-2 transition-all"
                    />
                  </div>

                  {/* Controls Row */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={togglePlay}
                        className="h-10 w-10 text-white hover:bg-white/20"
                      >
                        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => skip(-10)}
                        className="h-10 w-10 text-white hover:bg-white/20"
                      >
                        <SkipBack className="h-5 w-5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => skip(10)}
                        className="h-10 w-10 text-white hover:bg-white/20"
                      >
                        <SkipForward className="h-5 w-5" />
                      </Button>

                      <div className="flex items-center gap-2 ml-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={toggleMute}
                          className="h-10 w-10 text-white hover:bg-white/20"
                        >
                          {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                        </Button>
                        <Slider
                          value={[isMuted ? 0 : volume]}
                          max={1}
                          step={0.1}
                          onValueChange={handleVolumeChange}
                          className="w-24"
                        />
                      </div>

                      <span className="text-sm text-white ml-4 font-medium tabular-nums">
                        {formatTime(currentTime)} / {formatTime(duration)}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={toggleFullscreen}
                      className="h-10 w-10 text-white hover:bg-white/20"
                    >
                      <Maximize className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          ) : (
            // No video - show thumbnail
            <div className="w-full h-full flex items-center justify-center bg-gray dark:bg-dark">
              {courseThumbnail ? (
                <Image
                  src={getSecureUrl(courseThumbnail)}
                  alt={courseTitle}
                  fill
                  className="object-cover opacity-20"
                  unoptimized={getSecureUrl(courseThumbnail).startsWith('/api/')}
                />
              ) : null}
              <div className="relative z-10 text-center p-6">
                <AlertCircle className="h-16 w-16 mx-auto mb-4 text-dark-5 dark:text-dark-6" />
                <p className="text-dark-5 dark:text-dark-6 text-lg font-medium">
                  No preview video available
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Free Sample Videos List */}
        {previewLessons.length > 0 && (
          <div className="border-t border-stroke dark:border-stroke-dark bg-gray dark:bg-dark">
            <div className="px-4 py-3 border-b border-stroke dark:border-stroke-dark">
              <h3 className="font-bold text-sm text-dark dark:text-white">
                Free Sample Videos:
              </h3>
            </div>
            <ScrollArea className="max-h-[300px]">
              <div className="divide-y divide-stroke dark:divide-stroke-dark">
                {previewLessons.map((lesson) => (
                  <button
                    key={lesson.id}
                    onClick={() => setSelectedLesson(lesson)}
                    className={cn(
                      "w-full flex items-center gap-4 p-4 transition-all text-left",
                      selectedLesson?.id === lesson.id 
                        ? "bg-primary/10 dark:bg-primary/15 border-l-4 border-primary" 
                        : "hover:bg-white dark:hover:bg-dark-2 border-l-4 border-transparent"
                    )}
                  >
                    {/* Thumbnail */}
                    <div className="relative w-28 h-16 rounded-lg overflow-hidden bg-white dark:bg-dark-2 shrink-0 shadow-md">
                      {courseThumbnail ? (
                        <Image
                          src={getSecureUrl(courseThumbnail)}
                          alt={lesson.title}
                          fill
                          className="object-cover"
                          unoptimized={getSecureUrl(courseThumbnail).startsWith('/api/')}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <PlayCircle className="h-8 w-8 text-dark-5 dark:text-dark-6" />
                        </div>
                      )}
                      {/* Play icon overlay */}
                      <div className={cn(
                        "absolute inset-0 flex items-center justify-center transition-colors",
                        selectedLesson?.id === lesson.id 
                          ? "bg-primary/60" 
                          : "bg-black/40 hover:bg-black/50"
                      )}>
                        {selectedLesson?.id === lesson.id && isPlaying ? (
                          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-lg">
                            <Pause className="h-4 w-4 text-primary" />
                          </div>
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-lg">
                            <Play className="h-4 w-4 text-primary ml-0.5" />
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Lesson info */}
                    <div className="flex-1 min-w-0">
                      <p className={cn(
                        "text-sm font-semibold line-clamp-2 leading-snug",
                        selectedLesson?.id === lesson.id 
                          ? "text-primary" 
                          : "text-dark dark:text-white"
                      )}>
                        {lesson.title}
                      </p>
                      {lesson.sectionTitle && (
                        <p className="text-xs text-dark-5 dark:text-dark-6 mt-1.5 line-clamp-1">
                          {lesson.sectionTitle}
                        </p>
                      )}
                    </div>

                    {/* ✅ Duration - now shows actual video duration */}
                    <div className="text-sm text-dark-5 dark:text-dark-6 shrink-0 font-semibold tabular-nums">
                      {getLessonDuration(lesson)}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* No preview lessons message */}
        {previewLessons.length === 0 && !previewVideo && (
          <div className="p-10 text-center bg-gray dark:bg-dark">
            <PlayCircle className="h-14 w-14 mx-auto mb-4 text-dark-5 dark:text-dark-6" />
            <p className="text-dark-5 dark:text-dark-6 font-medium">
              No free preview lessons available for this course.
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}