// ============================================
// FILE: components/instructor/FileUploader.tsx
// Generic file uploader supporting all file types
// Uses presigned URLs for direct S3 upload
// ============================================

'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  X, 
  File,
  FileText,
  FileImage,
  FileVideo,
  FileAudio,
  CheckCircle, 
  AlertCircle,
  Loader2,
  Trash2,
  ExternalLink,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useS3Upload } from '@/hooks/use-s3-upload';
import { toast } from 'sonner';

interface UploadedFile {
  url: string;
  key: string;
  fileName: string;
  fileSize: number;
  fileType: string;
}

interface FileUploaderProps {
  onUploadComplete?: (file: UploadedFile) => void;
  onRemove?: (file: UploadedFile) => void;
  accept?: string;
  maxSize?: number;
  multiple?: boolean;
  existingFiles?: UploadedFile[];
  className?: string;
  label?: string;
  hint?: string;
}

// Get icon for file type
function getFileIcon(type: string) {
  if (type.startsWith('video/')) return FileVideo;
  if (type.startsWith('audio/')) return FileAudio;
  if (type.startsWith('image/')) return FileImage;
  if (type.includes('pdf') || type.includes('document') || type.includes('text')) return FileText;
  return File;
}

export function FileUploader({
  onUploadComplete,
  onRemove,
  accept = '*/*',
  maxSize = 100 * 1024 * 1024, // 100MB default
  multiple = false,
  existingFiles = [],
  className,
  label = 'Upload files',
  hint,
}: FileUploaderProps) {
  const [files, setFiles] = useState<UploadedFile[]>(existingFiles);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
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
      if (result.success && result.url && result.key && pendingFile) {
        const uploadedFile: UploadedFile = {
          url: result.url,
          key: result.key,
          fileName: pendingFile.name,
          fileSize: pendingFile.size,
          fileType: pendingFile.type,
        };
        
        if (multiple) {
          setFiles(prev => [...prev, uploadedFile]);
        } else {
          setFiles([uploadedFile]);
        }
        
        setPendingFile(null);
        onUploadComplete?.(uploadedFile);
        toast.success('File uploaded successfully!');
      }
    },
    onError: (err) => {
      toast.error(err.message || 'Upload failed');
    },
  });

  // Handle file selection
  const handleFileSelect = useCallback(async (file: File) => {
    // Validate file size
    if (file.size > maxSize) {
      toast.error(`File too large. Maximum size is ${formatBytes(maxSize)}`);
      return;
    }

    // Validate file type if specified
    if (accept !== '*/*') {
      const allowedTypes = accept.split(',').map(t => t.trim());
      const isAllowed = allowedTypes.some(type => {
        if (type.endsWith('/*')) {
          return file.type.startsWith(type.replace('/*', ''));
        }
        return file.type === type || file.name.endsWith(type.replace('*', ''));
      });
      
      if (!isAllowed) {
        toast.error('File type not allowed');
        return;
      }
    }

    setPendingFile(file);
    await upload(file);
  }, [accept, maxSize, formatBytes, upload]);

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    // Reset input
    e.target.value = '';
  };

  // Drag events
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

  // Remove file
  const handleRemove = (file: UploadedFile) => {
    setFiles(prev => prev.filter(f => f.key !== file.key));
    onRemove?.(file);
  };

  // Cancel upload
  const handleCancel = () => {
    cancel();
    setPendingFile(null);
  };

  return (
    <div className={cn("space-y-3", className)}>
      {/* Existing files */}
      {files.map((file, idx) => {
        const Icon = getFileIcon(file.fileType);
        return (
          <div 
            key={file.key || idx}
            className="flex items-center gap-3 p-3 bg-gray dark:bg-dark rounded-lg border border-stroke dark:border-stroke-dark"
          >
            <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-3.5 w-3.5 text-green shrink-0" />
                <p className="text-sm font-medium truncate">{file.fileName}</p>
              </div>
              <p className="text-xs text-dark-5">{formatBytes(file.fileSize)}</p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => window.open(file.url, '_blank')}
                title="View"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-red hover:text-red hover:bg-red/10"
                onClick={() => handleRemove(file)}
                title="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}

      {/* Upload progress */}
      {uploading && pendingFile && progress && (
        <div className="p-4 bg-gray dark:bg-dark rounded-lg border border-stroke dark:border-stroke-dark">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 text-primary animate-spin shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{pendingFile.name}</p>
              <p className="text-xs text-dark-5">
                {formatBytes(progress.loaded)} / {formatBytes(progress.total)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleCancel}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={progress.percentage} className="h-1.5" />
          <div className="flex justify-between text-xs text-dark-5 mt-1.5">
            <span>{progress.percentage}%</span>
            <span>{formatBytes(progress.speed)}/s • {formatTime(progress.remainingTime)} left</span>
          </div>
        </div>
      )}

      {/* Drop zone */}
      {(!files.length || multiple) && !uploading && (
        <div
          className={cn(
            "border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-stroke dark:border-stroke-dark hover:border-primary/50",
            error && "border-red/50"
          )}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
        >
          <div className="flex flex-col items-center gap-2">
            <div className="h-10 w-10 bg-primary/10 rounded-full flex items-center justify-center">
              <Upload className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-medium text-dark dark:text-white">
                {label}
              </p>
              <p className="text-xs text-dark-5 mt-0.5">
                {hint || `Drag & drop or click to browse (max ${formatBytes(maxSize)})`}
              </p>
            </div>
          </div>

          {error && (
            <div className="flex items-center justify-center gap-1.5 text-red text-xs mt-2">
              <AlertCircle className="h-3.5 w-3.5" />
              <span>{error}</span>
            </div>
          )}

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
          />
        </div>
      )}
    </div>
  );
}