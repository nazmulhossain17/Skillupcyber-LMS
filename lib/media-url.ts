// ============================================
// FILE: lib/media-url.ts
// Helper to convert S3 URLs to secure proxy URLs
// ============================================

/**
 * Converts S3 URLs to secure proxy URLs
 * 
 * Input examples:
 * - https://bucket.s3.ap-southeast-2.amazonaws.com/uploads/videos/file.mp4
 * - https://s3.ap-southeast-2.amazonaws.com/bucket/uploads/videos/file.mp4
 * - /api/media/abc123...
 * - uploads/videos/file.mp4
 * 
 * Output: /api/files/uploads/videos/file.mp4 or /api/media/abc123...
 */
export function getSecureUrl(url: string | null | undefined): string {
  if (!url) return '';
  
  // Trim whitespace
  url = url.trim();
  
  // Already a secure URL - return as-is
  if (url.startsWith('/api/media/') || url.startsWith('/api/files/')) {
    return url;
  }
  
  // S3 URL Pattern 1: bucket.s3.region.amazonaws.com/path
  // https://eduzpro.s3.ap-southeast-2.amazonaws.com/uploads/videos/file.mp4
  const s3Pattern1 = /https?:\/\/([^.]+)\.s3\.([^.]+)\.amazonaws\.com\/(.+)/;
  const match1 = url.match(s3Pattern1);
  if (match1) {
    const path = match1[3];
    console.log('🔄 Converting S3 URL (pattern 1):', url, '→', `/api/files/${path}`);
    return `/api/files/${path}`;
  }
  
  // S3 URL Pattern 2: s3.region.amazonaws.com/bucket/path
  // https://s3.ap-southeast-2.amazonaws.com/eduzpro/uploads/videos/file.mp4
  const s3Pattern2 = /https?:\/\/s3\.([^.]+)\.amazonaws\.com\/([^/]+)\/(.+)/;
  const match2 = url.match(s3Pattern2);
  if (match2) {
    const path = match2[3];
    console.log('🔄 Converting S3 URL (pattern 2):', url, '→', `/api/files/${path}`);
    return `/api/files/${path}`;
  }
  
  // S3 URL Pattern 3: bucket.s3.amazonaws.com/path (us-east-1)
  // https://eduzpro.s3.amazonaws.com/uploads/videos/file.mp4
  const s3Pattern3 = /https?:\/\/([^.]+)\.s3\.amazonaws\.com\/(.+)/;
  const match3 = url.match(s3Pattern3);
  if (match3) {
    const path = match3[2];
    console.log('🔄 Converting S3 URL (pattern 3):', url, '→', `/api/files/${path}`);
    return `/api/files/${path}`;
  }
  
  // Relative path without leading slash
  if (!url.startsWith('http') && !url.startsWith('/')) {
    return `/api/files/${url}`;
  }
  
  // External URL or already correct - return as-is
  return url;
}

/**
 * Check if a URL is a secure media URL
 */
export function isSecureUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.startsWith('/api/media/') || url.startsWith('/api/files/');
}

/**
 * Extract secure ID from media URL
 * /api/media/abc123def456... → abc123def456...
 */
export function getSecureIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  
  const match = url.match(/\/api\/media\/([a-f0-9]+)/);
  return match ? match[1] : null;
}

/**
 * Build a media URL from secure ID
 */
export function buildMediaUrl(secureId: string): string {
  return `/api/media/${secureId}`;
}

/**
 * Get thumbnail URL (with fallback)
 */
export function getThumbnailUrl(
  url: string | null | undefined, 
  fallback: string = '/images/placeholder-course.jpg'
): string {
  if (!url) return fallback;
  return getSecureUrl(url);
}

/**
 * Check if URL is a video
 */
export function isVideoUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi'];
  const lowerUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowerUrl.includes(ext));
}

/**
 * Check if URL is an image
 */
export function isImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext));
}