// ============================================
// FILE: components/courses/VideoPlayer.tsx
// Fixed with error handling and URL conversion
// ============================================

'use client';

import { useRef, useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  SkipBack,
  SkipForward,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface VideoPlayerProps {
  videoUrl: string;
  playbackId?: string | null;
  lessonId: string;
  courseSlug: string;
  onProgress?: (watchedSeconds: number) => void;
  onComplete?: () => void;
}

// ✅ Convert S3 URLs to secure proxy URLs
function getSecureVideoUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // Already a secure URL
  if (url.startsWith('/api/media/') || url.startsWith('/api/files/')) {
    return url;
  }
  
  // Convert S3 URL to proxy URL
  // https://bucket.s3.region.amazonaws.com/path/file.mp4 → /api/files/path/file.mp4
  const s3Pattern = /https?:\/\/[^/]+\.s3\.[^/]+\.amazonaws\.com\/(.+)/;
  const match = url.match(s3Pattern);
  if (match) {
    return `/api/files/${match[1]}`;
  }
  
  // Direct S3 path pattern
  // https://s3.region.amazonaws.com/bucket/path/file.mp4 → /api/files/path/file.mp4
  const s3Pattern2 = /https?:\/\/s3\.[^/]+\.amazonaws\.com\/[^/]+\/(.+)/;
  const match2 = url.match(s3Pattern2);
  if (match2) {
    return `/api/files/${match2[1]}`;
  }
  
  // Return as-is if it's a relative path or external URL
  return url;
}

export function VideoPlayer({ 
  videoUrl, 
  playbackId, 
  lessonId, 
  courseSlug,
  onProgress,
  onComplete,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ✅ Get the secure video URL
  const secureUrl = getSecureVideoUrl(videoUrl);

  // ✅ Debug logging
  useEffect(() => {
    console.log('🎬 VideoPlayer mounted');
    console.log('   Original URL:', videoUrl);
    console.log('   Secure URL:', secureUrl);
  }, [videoUrl, secureUrl]);

  // ✅ Setup video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      console.log('✅ Video metadata loaded, duration:', video.duration);
      setDuration(video.duration);
      setIsLoading(false);
      setError(null);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(video.currentTime);
    };

    const handleEnded = () => {
      console.log('🏁 Video ended');
      setIsPlaying(false);
      markAsCompleted();
      onComplete?.();
    };

    const handleWaiting = () => {
      console.log('⏳ Video buffering...');
      setIsLoading(true);
    };
    
    const handleCanPlay = () => {
      console.log('✅ Video can play');
      setIsLoading(false);
      setError(null);
    };

    const handleError = (e: Event) => {
      const videoEl = e.target as HTMLVideoElement;
      const mediaError = videoEl.error;
      
      console.error('❌ Video error:', mediaError);
      
      let errorMessage = 'Failed to load video';
      
      if (mediaError) {
        switch (mediaError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Video loading was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = 'Network error while loading video';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = 'Video format not supported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = 'Video source not supported or not found';
            break;
        }
      }
      
      setError(errorMessage);
      setIsLoading(false);
    };

    const handleLoadStart = () => {
      console.log('📥 Video load started');
      setIsLoading(true);
      setError(null);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
    };
  }, [onComplete]);

  // ✅ Progress tracking
  useEffect(() => {
    if (isPlaying && onProgress) {
      progressIntervalRef.current = setInterval(() => {
        if (videoRef.current) {
          onProgress(Math.floor(videoRef.current.currentTime));
        }
      }, 10000); // Every 10 seconds
    }

    return () => {
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, [isPlaying, onProgress]);

  const markAsCompleted = async () => {
    try {
      await fetch(`/api/learn/${courseSlug}/lessons/${lessonId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          lessonId, 
          completed: true,
          watchedSeconds: Math.floor(duration),
        }),
      });
      console.log('✅ Marked as completed');
    } catch (error) {
      console.error('Failed to mark as completed:', error);
    }
  };

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video || error) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.error('Play error:', err);
          setError('Failed to play video. Please try again.');
        });
    }
  }, [isPlaying, error]);

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
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const skip = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.max(0, Math.min(duration, video.currentTime + seconds));
  };

  const changeSpeed = () => {
    const video = videoRef.current;
    if (!video) return;
    
    const speeds = [0.5, 0.75, 1, 1.25, 1.5, 2];
    const currentIndex = speeds.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % speeds.length;
    const newSpeed = speeds[nextIndex];
    
    video.playbackRate = newSpeed;
    setPlaybackSpeed(newSpeed);
    toast.info(`Playback speed: ${newSpeed}x`);
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  // ✅ Retry loading video
  const handleRetry = () => {
    const video = videoRef.current;
    if (!video) return;
    
    setError(null);
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
    
    // Force reload by updating src
    video.src = secureUrl + (secureUrl.includes('?') ? '&' : '?') + `retry=${retryCount + 1}`;
    video.load();
  };

  // ✅ Handle missing video URL
  if (!videoUrl) {
    return (
      <div className="relative w-full aspect-video bg-gray-900 flex items-center justify-center">
        <div className="text-center text-white">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
          <p className="text-lg font-medium">No video available</p>
          <p className="text-sm text-gray-400 mt-2">This lesson doesn't have a video yet</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="relative w-full aspect-video bg-black group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
    >
      {/* ✅ Video Element with proper attributes */}
      <video
        ref={videoRef}
        src={secureUrl}
        className="w-full h-full"
        onClick={togglePlay}
        playsInline
        preload="metadata"
        crossOrigin="use-credentials"
      />

      {/* Loading Spinner */}
      {isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-white mx-auto" />
            <p className="text-white mt-4 text-sm">Loading video...</p>
          </div>
        </div>
      )}

      {/* ✅ Error State */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80">
          <div className="text-center p-6 max-w-md">
            <AlertCircle className="h-16 w-16 mx-auto mb-4 text-red" />
            <p className="text-white text-lg font-medium mb-2">Video Error</p>
            <p className="text-gray-400 text-sm mb-4">{error}</p>
            <div className="space-y-2">
              <Button
                onClick={handleRetry}
                className="bg-primary hover:bg-primary/90 text-white"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Try Again
              </Button>
              <p className="text-xs text-gray-500 mt-4">
                URL: {secureUrl.substring(0, 50)}...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Play button overlay when paused */}
      {!isPlaying && !isLoading && !error && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 transition-opacity"
        >
          <div className="w-20 h-20 rounded-full bg-white/90 flex items-center justify-center hover:scale-110 transition-transform">
            <Play className="h-10 w-10 text-black ml-1" />
          </div>
        </button>
      )}

      {/* Controls */}
      {!error && (
        <div 
          className={cn(
            "absolute bottom-0 left-0 right-0 bg-linear-to-t from-black/80 to-transparent p-4 transition-opacity duration-300",
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
        >
          {/* Progress Bar */}
          <Slider
            value={[currentTime]}
            max={duration || 100}
            step={0.1}
            onValueChange={handleSeek}
            className="mb-4"
          />

          {/* Controls Row */}
          <div className="flex items-center justify-between">
            {/* Left Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={togglePlay}
                className="text-white hover:bg-white/20 h-8 w-8 sm:h-10 sm:w-10"
              >
                {isPlaying ? (
                  <Pause className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(-10)}
                className="text-white hover:bg-white/20 h-8 w-8 sm:h-10 sm:w-10"
              >
                <SkipBack className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => skip(10)}
                className="text-white hover:bg-white/20 h-8 w-8 sm:h-10 sm:w-10"
              >
                <SkipForward className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>

              {/* Volume - Hidden on mobile */}
              <div className="hidden sm:flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleMute}
                  className="text-white hover:bg-white/20 h-10 w-10"
                >
                  {isMuted ? (
                    <VolumeX className="h-5 w-5" />
                  ) : (
                    <Volume2 className="h-5 w-5" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-20"
                />
              </div>

              {/* Time */}
              <span className="text-white text-xs sm:text-sm ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-1 sm:gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={changeSpeed}
                className="text-white hover:bg-white/20 text-xs sm:text-sm px-2"
              >
                {playbackSpeed}x
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={toggleFullscreen}
                className="text-white hover:bg-white/20 h-8 w-8 sm:h-10 sm:w-10"
              >
                <Maximize className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}