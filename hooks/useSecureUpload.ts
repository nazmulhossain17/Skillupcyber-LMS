// ============================================
// FILE: hooks/useSecureUpload.ts
// Secure upload hook - uploads via server, stores privately
// ============================================

'use client';

import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface UploadOptions {
  folder?: string;
  type?: 'image' | 'video' | 'document' | 'audio';
  courseId?: string;
  isPublic?: boolean;
  onProgress?: (progress: number) => void;
  onSuccess?: (data: UploadResult) => void;
  onError?: (error: string) => void;
}

interface UploadResult {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
}

export function useSecureUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(async (
    file: File,
    options: UploadOptions = {}
  ): Promise<UploadResult | null> => {
    const {
      folder = 'uploads',
      type = 'image',
      courseId,
      isPublic = false,
      onProgress,
      onSuccess,
      onError,
    } = options;

    setUploading(true);
    setProgress(0);
    setError(null);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);
      formData.append('type', type);
      formData.append('public', isPublic.toString());
      if (courseId) {
        formData.append('courseId', courseId);
      }

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          const newProgress = Math.min(prev + 5, 90);
          onProgress?.(newProgress);
          return newProgress;
        });
      }, 100);

      // Upload via secure API
      const response = await fetch('/api/upload/secure', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setProgress(100);
      onProgress?.(100);
      onSuccess?.(data);

      return data;

    } catch (err: any) {
      const errorMessage = err.message || 'Upload failed';
      setError(errorMessage);
      onError?.(errorMessage);
      toast.error(errorMessage);
      return null;

    } finally {
      setUploading(false);
    }
  }, []);

  const uploadMultiple = useCallback(async (
    files: File[],
    options: UploadOptions = {}
  ): Promise<UploadResult[]> => {
    const results: UploadResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const result = await upload(files[i], {
        ...options,
        onProgress: (p) => {
          const overall = ((i / files.length) * 100) + (p / files.length);
          options.onProgress?.(Math.round(overall));
        },
      });
      if (result) {
        results.push(result);
      }
    }

    return results;
  }, [upload]);

  return {
    upload,
    uploadMultiple,
    uploading,
    progress,
    error,
  };
}


// ============================================
// FILE: lib/secure-upload.ts
// Simple function for secure uploads
// ============================================

export interface SecureUploadOptions {
  folder?: string;
  type?: 'image' | 'video' | 'document' | 'audio';
  courseId?: string;
  isPublic?: boolean;
}

export interface SecureUploadResult {
  id: string;
  url: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  category: string;
}

/**
 * Upload a file securely through the server
 * Files are stored privately and served through authenticated API
 */
export async function secureUpload(
  file: File,
  options: SecureUploadOptions = {}
): Promise<SecureUploadResult> {
  const {
    folder = 'uploads',
    type = 'image',
    courseId,
    isPublic = false,
  } = options;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', folder);
  formData.append('type', type);
  formData.append('public', isPublic.toString());
  if (courseId) {
    formData.append('courseId', courseId);
  }

  const response = await fetch('/api/upload/secure', {
    method: 'POST',
    body: formData,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Upload failed');
  }

  return data;
}

/**
 * Get the full URL for a secure media file
 */
export function getSecureMediaUrl(secureId: string): string {
  if (!secureId) return '';
  
  // If it's already a full URL, return as-is
  if (secureId.startsWith('http') || secureId.startsWith('/api/media/')) {
    return secureId;
  }
  
  return `/api/media/${secureId}`;
}