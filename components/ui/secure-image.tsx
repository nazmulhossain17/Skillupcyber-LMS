// ============================================
// FILE: components/ui/secure-image.tsx
// Image component that handles /api/ routes properly
// ============================================

'use client';

import Image, { ImageProps } from 'next/image';
import { useState } from 'react';

interface SecureImageProps extends Omit<ImageProps, 'src'> {
  src: string | null | undefined;
  fallback?: string;
}

/**
 * Helper to convert S3 URLs to secure proxy URLs
 */
function getSecureUrl(url: string | null | undefined): string {
  if (!url) return '';
  url = url.trim();
  
  // Already a secure/local URL
  if (url.startsWith('/api/') || url.startsWith('/images/') || url.startsWith('/assets/')) {
    return url;
  }
  
  // S3 URL patterns - convert to proxy
  const s3Pattern1 = /https?:\/\/([^.]+)\.s3\.([^.]+)\.amazonaws\.com\/(.+)/;
  const match1 = url.match(s3Pattern1);
  if (match1) return `/api/files/${match1[3]}`;
  
  const s3Pattern2 = /https?:\/\/s3\.([^.]+)\.amazonaws\.com\/([^/]+)\/(.+)/;
  const match2 = url.match(s3Pattern2);
  if (match2) return `/api/files/${match2[3]}`;
  
  const s3Pattern3 = /https?:\/\/([^.]+)\.s3\.amazonaws\.com\/(.+)/;
  const match3 = url.match(s3Pattern3);
  if (match3) return `/api/files/${match3[2]}`;
  
  // Relative path without leading slash
  if (!url.startsWith('http') && !url.startsWith('/')) {
    return `/api/files/${url}`;
  }
  
  return url;
}

/**
 * SecureImage component
 * - Automatically converts S3 URLs to proxy URLs
 * - Disables Next.js optimization for API routes (prevents 400 error)
 * - Shows fallback on error
 */
export function SecureImage({ 
  src, 
  fallback = '/images/placeholder.jpg',
  alt,
  ...props 
}: SecureImageProps) {
  const [error, setError] = useState(false);
  const [loaded, setLoaded] = useState(false);
  
  // Convert to secure URL
  const secureUrl = getSecureUrl(src);
  
  // Use fallback if no src or error
  const imageSrc = error || !secureUrl ? fallback : secureUrl;
  
  // ✅ Disable Next.js optimization for API routes
  // This prevents the 400 Bad Request error
  const isApiRoute = imageSrc.startsWith('/api/');
  
  return (
    <Image
      src={imageSrc}
      alt={alt}
      onError={() => setError(true)}
      onLoad={() => setLoaded(true)}
      // ✅ Key fix: unoptimized for API routes
      unoptimized={isApiRoute}
      {...props}
    />
  );
}

/**
 * Simple img tag for cases where Next.js Image doesn't work well
 * Use this for dynamic API URLs if SecureImage still causes issues
 */
export function SecureImg({ 
  src, 
  fallback = '/images/placeholder.jpg',
  alt,
  className,
  ...props 
}: React.ImgHTMLAttributes<HTMLImageElement> & { 
  src: string | null | undefined;
  fallback?: string;
}) {
  const [error, setError] = useState(false);
  
  const secureUrl = getSecureUrl(src);
  const imageSrc = error || !secureUrl ? fallback : secureUrl;
  
  return (
    <img
      src={imageSrc}
      alt={alt || ''}
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
}

export { getSecureUrl };