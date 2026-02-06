// ============================================
// FILE: hooks/use-s3-upload.ts
// Client-side hook for uploading files directly to S3
// Supports small files (presigned URL) and large files (multipart)
// Bypasses Vercel's 4.5MB limit completely
// ============================================

import { useState, useCallback, useRef } from 'react';

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed: number; // bytes per second
  remainingTime: number; // seconds
}

export interface UploadResult {
  success: boolean;
  url?: string;
  key?: string;
  error?: string;
}

interface UseS3UploadOptions {
  onProgress?: (progress: UploadProgress) => void;
  onComplete?: (result: UploadResult) => void;
  onError?: (error: Error) => void;
}

// Threshold for multipart upload (100MB)
const MULTIPART_THRESHOLD = 100 * 1024 * 1024;

// Part size for multipart (100MB)
const PART_SIZE = 100 * 1024 * 1024;

// Max concurrent uploads
const MAX_CONCURRENT = 4;

export function useS3Upload(options: UseS3UploadOptions = {}) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  // Calculate progress stats
  const calculateProgress = useCallback((loaded: number, total: number): UploadProgress => {
    const percentage = Math.round((loaded / total) * 100);
    const elapsed = (Date.now() - startTimeRef.current) / 1000;
    const speed = elapsed > 0 ? loaded / elapsed : 0;
    const remaining = total - loaded;
    const remainingTime = speed > 0 ? remaining / speed : 0;

    return {
      loaded,
      total,
      percentage,
      speed,
      remainingTime,
    };
  }, []);

  // Simple upload for small files (<100MB)
  const uploadSimple = useCallback(async (
    file: File,
    signal: AbortSignal
  ): Promise<UploadResult> => {
    // Get presigned URL
    const presignedRes = await fetch('/api/s3/presigned', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
      signal,
    });

    if (!presignedRes.ok) {
      const data = await presignedRes.json();
      throw new Error(data.error || 'Failed to get upload URL');
    }

    const { presignedUrl, key, publicUrl } = await presignedRes.json();

    // Upload directly to S3
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const prog = calculateProgress(e.loaded, e.total);
          setProgress(prog);
          options.onProgress?.(prog);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ success: true, url: publicUrl, key });
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => {
        reject(new Error('Upload failed'));
      });

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'));
      });

      // Handle abort signal
      signal.addEventListener('abort', () => {
        xhr.abort();
      });

      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', file.type);
      xhr.send(file);
    });
  }, [calculateProgress, options]);

  // Multipart upload for large files (>=100MB)
  const uploadMultipart = useCallback(async (
    file: File,
    signal: AbortSignal
  ): Promise<UploadResult> => {
    // Initialize multipart upload
    const initRes = await fetch('/api/s3/multipart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'init',
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
      }),
      signal,
    });

    if (!initRes.ok) {
      const data = await initRes.json();
      throw new Error(data.error || 'Failed to initialize upload');
    }

    const { uploadId, key, numParts } = await initRes.json();

    try {
      // Track uploaded parts
      const uploadedParts: { PartNumber: number; ETag: string }[] = [];
      let totalUploaded = 0;

      // Upload parts in batches
      for (let i = 0; i < numParts; i += MAX_CONCURRENT) {
        if (signal.aborted) throw new Error('Upload cancelled');

        const batch = [];
        const partNumbers = [];

        for (let j = i; j < Math.min(i + MAX_CONCURRENT, numParts); j++) {
          partNumbers.push(j + 1);
        }

        // Get presigned URLs for this batch
        const urlsRes = await fetch('/api/s3/multipart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'get-urls',
            key,
            uploadId,
            partNumbers,
          }),
          signal,
        });

        if (!urlsRes.ok) throw new Error('Failed to get part URLs');

        const { urls } = await urlsRes.json();

        // Upload each part in parallel
        const uploadPromises = urls.map(async ({ partNumber, url }: { partNumber: number; url: string }) => {
          const start = (partNumber - 1) * PART_SIZE;
          const end = Math.min(start + PART_SIZE, file.size);
          const chunk = file.slice(start, end);

          const response = await fetch(url, {
            method: 'PUT',
            body: chunk,
            signal,
          });

          if (!response.ok) {
            throw new Error(`Failed to upload part ${partNumber}`);
          }

          const etag = response.headers.get('ETag');
          if (!etag) throw new Error(`No ETag for part ${partNumber}`);

          totalUploaded += chunk.size;
          const prog = calculateProgress(totalUploaded, file.size);
          setProgress(prog);
          options.onProgress?.(prog);

          return {
            PartNumber: partNumber,
            ETag: etag.replace(/"/g, ''),
          };
        });

        const results = await Promise.all(uploadPromises);
        uploadedParts.push(...results);
      }

      // Complete multipart upload
      const completeRes = await fetch('/api/s3/multipart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'complete',
          key,
          uploadId,
          parts: uploadedParts,
        }),
        signal,
      });

      if (!completeRes.ok) {
        const data = await completeRes.json();
        throw new Error(data.error || 'Failed to complete upload');
      }

      const { publicUrl } = await completeRes.json();
      return { success: true, url: publicUrl, key };

    } catch (err) {
      // Abort the multipart upload on error
      try {
        await fetch('/api/s3/multipart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'abort',
            key,
            uploadId,
          }),
        });
      } catch {
        // Ignore abort errors
      }
      throw err;
    }
  }, [calculateProgress, options]);

  // Main upload function
  const upload = useCallback(async (file: File): Promise<UploadResult> => {
    setUploading(true);
    setError(null);
    setProgress(null);
    startTimeRef.current = Date.now();

    // Create abort controller
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;

    try {
      let result: UploadResult;

      if (file.size >= MULTIPART_THRESHOLD) {
        // Use multipart for large files
        result = await uploadMultipart(file, signal);
      } else {
        // Use simple upload for small files
        result = await uploadSimple(file, signal);
      }

      options.onComplete?.(result);
      return result;

    } catch (err: any) {
      const errorMessage = err.message || 'Upload failed';
      setError(errorMessage);
      options.onError?.(err);
      return { success: false, error: errorMessage };

    } finally {
      setUploading(false);
      abortControllerRef.current = null;
    }
  }, [uploadSimple, uploadMultipart, options]);

  // Cancel upload
  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Format bytes for display
  const formatBytes = useCallback((bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  }, []);

  // Format time for display
  const formatTime = useCallback((seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  }, []);

  return {
    upload,
    cancel,
    uploading,
    progress,
    error,
    formatBytes,
    formatTime,
  };
}

// Export type for use in components
export type UseS3UploadReturn = ReturnType<typeof useS3Upload>;