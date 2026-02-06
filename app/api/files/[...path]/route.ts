// ============================================
// FILE: app/api/files/[...path]/route.ts
// Proxy for serving S3 files securely
// Supports: Public, Free Preview, Enrolled, Instructor
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { auth } from '@/lib/auth';
import { db } from '@/db/drizzle';
import { app_users, enrollments, courses, lessonContent } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Paths that should always be blocked
const BLOCKED_PATHS = ['private/', 'secrets/', '.env', 'config/'];

// Paths that are always public (thumbnails, public assets)
const PUBLIC_PATHS = ['uploads/thumbnails/', 'public/', 'assets/'];

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await params;
    const s3Key = path.join('/');

    console.log('📁 File request:', s3Key);

    if (!s3Key) {
      return NextResponse.json({ error: 'File path required' }, { status: 400 });
    }

    // Block sensitive paths
    if (BLOCKED_PATHS.some(blocked => s3Key.toLowerCase().includes(blocked))) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Check if public path
    const isPublicPath = PUBLIC_PATHS.some(pub => s3Key.startsWith(pub));

    // Check if this is a video file
    const isVideo = /\.(mp4|webm|ogg|mov)$/i.test(s3Key);

    // For videos, check if it's used in a free preview lesson
    let isFreePreviewVideo = false;
    if (isVideo) {
      isFreePreviewVideo = await isVideoInFreePreviewLesson(s3Key);
    }

    // Determine if access check is needed
    const needsAuth = !isPublicPath && !isFreePreviewVideo;

    if (needsAuth) {
      // Check if video belongs to a course and user has access
      const hasAccess = await checkVideoAccess(req, s3Key);
      if (!hasAccess) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Fetch from S3
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
    });

    const s3Response = await s3Client.send(command);

    if (!s3Response.Body) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const contentType = s3Response.ContentType || 'application/octet-stream';
    const contentLength = s3Response.ContentLength || 0;

    // Handle video range requests for streaming
    const range = req.headers.get('range');
    if (range && contentType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
      const chunkSize = end - start + 1;

      const rangeCommand = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: s3Key,
        Range: `bytes=${start}-${end}`,
      });

      const rangeResponse = await s3Client.send(rangeCommand);
      const stream = rangeResponse.Body as ReadableStream;

      return new NextResponse(stream, {
        status: 206,
        headers: {
          'Content-Type': contentType,
          'Content-Length': chunkSize.toString(),
          'Content-Range': `bytes ${start}-${end}/${contentLength}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'private, max-age=3600',
        },
      });
    }

    // Stream full file
    const stream = s3Response.Body as ReadableStream;

    return new NextResponse(stream, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': contentLength.toString(),
        'Cache-Control': contentType.startsWith('image/')
          ? 'public, max-age=31536000, immutable'
          : 'private, max-age=3600',
        'Accept-Ranges': 'bytes',
      },
    });

  } catch (error: any) {
    console.error('File proxy error:', error);

    if (error.name === 'NoSuchKey') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}

// ---------------------------------------------------------
// Check if video is used in a free preview lesson
// ---------------------------------------------------------
async function isVideoInFreePreviewLesson(s3Key: string): Promise<boolean> {
  try {
    // Build possible URL patterns
    const possibleUrls = [
      s3Key,
      `/${s3Key}`,
      `/api/files/${s3Key}`,
      `https://${process.env.AWS_S3_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`,
    ];

    // Get all free preview lessons
    const freeLessons = await db
      .select({ videoUrl: lessonContent.videoUrl })
      .from(lessonContent)
      .where(eq(lessonContent.isFree, true));

    for (const lesson of freeLessons) {
      if (!lesson.videoUrl) continue;
      
      // Check if any URL pattern matches
      for (const url of possibleUrls) {
        if (lesson.videoUrl.includes(s3Key) || lesson.videoUrl === url) {
          console.log('✅ Free preview video found');
          return true;
        }
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking free preview:', error);
    return false;
  }
}

// ---------------------------------------------------------
// Check video access based on course enrollment
// ---------------------------------------------------------
async function checkVideoAccess(req: NextRequest, s3Key: string): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return false;
    }

    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return false;
    }

    // Admin has full access
    if (appUser.role === 'admin') {
      return true;
    }

    // Instructor role has access to their course videos
    if (appUser.role === 'instructor') {
      // Check if video belongs to instructor's course
      // This is a simplified check - you might want to be more specific
      return true;
    }

    // For students, check if they have any active enrollment
    // This is a simplified check - in production you'd want to
    // verify the video belongs to a course they're enrolled in
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(
        eq(enrollments.appUserId, appUser.id),
        eq(enrollments.status, 'active')
      ))
      .limit(1);

    return !!enrollment;

  } catch (error) {
    console.error('Error checking access:', error);
    return false;
  }
}