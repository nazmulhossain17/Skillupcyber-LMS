// ============================================
// FILE: components/instructor/VideoUploader.tsx
// Video uploader component with progress tracking
// Supports files up to 7GB
// ============================================

'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  X, 
  Video, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  FileVideo,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useS3Upload, UploadProgress } from '@/hooks/use-s3-upload';
import { toast } from 'sonner';

interface VideoUploaderProps {
  onUploadComplete?: (url: string, key: string) => void;
  onUploadError?: (error: string) => void;
  maxSize?: number; // in bytes, default 7GB
  accept?: string;
  className?: string;
  existingUrl?: string;
  onRemove?: () => void;
}

export function VideoUploader({
  onUploadComplete,
  onUploadError,
  maxSize = 7 * 1024 * 1024 * 1024, // 7GB
  accept = 'video/mp4,video/webm,video/quicktime,video/x-msvideo,video/x-matroska',
  className,
  existingUrl,
  onRemove,
}: VideoUploaderProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingUrl || null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    upload,
    cancel,
    uploading,
    progress,
    error,
    formatBytes,
    formatTime,
  } = useS3Upload({
    onComplete: (result) => {
      if (result.success && result.url && result.key) {
        setUploadedUrl(result.url);
        setSelectedFile(null);
        onUploadComplete?.(result.url, result.key);
        toast.success('Video uploaded successfully!');
      }
    },
    onError: (err) => {
      onUploadError?.(err.message);
      toast.error(err.message || 'Upload failed');
    },
  });

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    const allowedTypes = accept.split(',').map(t => t.trim());
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type. Please select a video file.');
      return;
    }

    // Validate file size
    if (file.size > maxSize) {
      toast.error(`File too large. Maximum size is ${formatBytes(maxSize)}`);
      return;
    }

    setSelectedFile(file);
    setUploadedUrl(null);
  }, [accept, maxSize, formatBytes]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  // Start upload
  const handleUpload = async () => {
    if (!selectedFile) return;
    await upload(selectedFile);
  };

  // Cancel/remove
  const handleCancel = () => {
    if (uploading) {
      cancel();
    }
    setSelectedFile(null);
  };

  // Remove uploaded video
  const handleRemove = () => {
    setUploadedUrl(null);
    setSelectedFile(null);
    onRemove?.();
  };

  // Already have an uploaded video
  if (uploadedUrl) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="h-16 w-24 bg-dark-3 rounded flex items-center justify-center">
              <Video className="h-8 w-8 text-dark-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green shrink-0" />
                <span className="text-sm font-medium text-green">Video uploaded</span>
              </div>
              <p className="text-xs text-dark-5 truncate mt-1">
                {uploadedUrl.split('/').pop()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(uploadedUrl, '_blank')}
              >
                Preview
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-red hover:text-red hover:bg-red/10"
                onClick={handleRemove}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Uploading state
  if (uploading && progress) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-sm">{selectedFile?.name}</p>
                <p className="text-xs text-dark-5">
                  {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="text-red hover:text-red hover:bg-red/10"
                onClick={handleCancel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-2">
              <Progress value={progress.percentage} className="h-2" />
              <div className="flex justify-between text-xs text-dark-5">
                <span>{progress.percentage}%</span>
                <span>
                  {formatBytes(progress.speed)}/s • {formatTime(progress.remainingTime)} remaining
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // File selected, ready to upload
  if (selectedFile) {
    return (
      <Card className={cn("overflow-hidden", className)}>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <FileVideo className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{selectedFile.name}</p>
                <p className="text-xs text-dark-5">{formatBytes(selectedFile.size)}</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelectedFile(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1"
                onClick={handleUpload}
              >
                <Upload className="h-4 w-4 mr-2" />
                Upload Video
              </Button>
              <Button
                variant="outline"
                onClick={() => inputRef.current?.click()}
              >
                Change
              </Button>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
          />
        </CardContent>
      </Card>
    );
  }

  // Default drop zone
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-0">
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-8 text-center transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-stroke dark:border-stroke-dark hover:border-primary/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="flex flex-col items-center gap-4">
            <div className="h-16 w-16 bg-primary/10 rounded-full flex items-center justify-center">
              <Video className="h-8 w-8 text-primary" />
            </div>
            
            <div>
              <p className="font-medium text-dark dark:text-white">
                Drag and drop your video here
              </p>
              <p className="text-sm text-dark-5 mt-1">
                or click to browse
              </p>
            </div>

            <Button
              variant="outline"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4 mr-2" />
              Select Video
            </Button>

            <p className="text-xs text-dark-5">
              Supports MP4, WebM, MOV, AVI, MKV up to {formatBytes(maxSize)}
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      </CardContent>
    </Card>
  );
}