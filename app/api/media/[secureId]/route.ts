// ============================================
// FILE: app/api/media/[secureId]/route.ts
// Serve and delete secure media files
// Supports: Owner, Enrolled, Instructor, Admin, FREE PREVIEW
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { S3Client, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { db } from '@/db/drizzle';
import { app_users, media_files, enrollments, courses, lessonContent } from '@/db/schema';
import { eq, and } from 'drizzle-orm';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// ---------------------------------------------------------
// GET - Serve file with access control
// ---------------------------------------------------------
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ secureId: string }> }
) {
  try {
    const { secureId } = await params;
    console.log('📹 Media request:', secureId);

    // Find file in database
    const [mediaFile] = await db
      .select()
      .from(media_files)
      .where(eq(media_files.secureId, secureId))
      .limit(1);

    if (!mediaFile) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Check access permissions
    const { hasAccess, reason } = await checkAccess(req, mediaFile);
    
    if (!hasAccess) {
      console.log('❌ Access denied:', reason);
      return NextResponse.json({ error: 'Access denied', reason }, { status: 403 });
    }

    console.log('✅ Access granted:', reason);

    // Get file from S3
    const command = new GetObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: mediaFile.s3Key,
    });

    const s3Response = await s3Client.send(command);

    if (!s3Response.Body) {
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 });
    }

    const contentType = mediaFile.mimeType;
    const contentLength = mediaFile.fileSize;

    // Handle range requests for video streaming
    const range = req.headers.get('range');
    if (range && contentType.startsWith('video/')) {
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : contentLength - 1;
      const chunkSize = end - start + 1;

      const rangeCommand = new GetObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET_NAME!,
        Key: mediaFile.s3Key,
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
    console.error('Media serve error:', error);
    return NextResponse.json({ error: 'Failed to serve file' }, { status: 500 });
  }
}

// ---------------------------------------------------------
// DELETE - Remove file (owner/admin only)
// ---------------------------------------------------------
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ secureId: string }> }
) {
  try {
    const { secureId } = await params;

    // Auth required for delete
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Find file
    const [mediaFile] = await db
      .select()
      .from(media_files)
      .where(eq(media_files.secureId, secureId))
      .limit(1);

    if (!mediaFile) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Only owner or admin can delete
    if (mediaFile.uploadedBy !== appUser.id && appUser.role !== 'admin') {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Delete from S3
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: mediaFile.s3Key,
    }));

    // Delete from database
    await db.delete(media_files).where(eq(media_files.id, mediaFile.id));

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Media delete error:', error);
    return NextResponse.json({ error: 'Failed to delete file' }, { status: 500 });
  }
}

// ---------------------------------------------------------
// Check access permissions
// Returns: { hasAccess: boolean, reason: string }
// ---------------------------------------------------------
async function checkAccess(
  req: NextRequest, 
  mediaFile: any
): Promise<{ hasAccess: boolean; reason: string }> {
  
  // 1. Public files are accessible to everyone
  if (mediaFile.isPublic) {
    return { hasAccess: true, reason: 'public' };
  }

  // 2. Check if this video is used in a FREE PREVIEW lesson
  const isFreePreview = await isVideoInFreePreviewLesson(mediaFile.secureId);
  if (isFreePreview) {
    return { hasAccess: true, reason: 'free_preview' };
  }

  // 3. For private files, auth is required
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session?.user?.id) {
    return { hasAccess: false, reason: 'authentication_required' };
  }

  const [appUser] = await db
    .select()
    .from(app_users)
    .where(eq(app_users.userId, session.user.id))
    .limit(1);

  if (!appUser) {
    return { hasAccess: false, reason: 'user_not_found' };
  }

  // 4. Owner always has access
  if (mediaFile.uploadedBy === appUser.id) {
    return { hasAccess: true, reason: 'owner' };
  }

  // 5. Admin has full access
  if (appUser.role === 'admin') {
    return { hasAccess: true, reason: 'admin' };
  }

  // 6. Check course-based access
  if (mediaFile.courseId) {
    // Check enrollment
    const [enrollment] = await db
      .select()
      .from(enrollments)
      .where(and(
        eq(enrollments.courseId, mediaFile.courseId),
        eq(enrollments.appUserId, appUser.id),
        eq(enrollments.status, 'active')
      ))
      .limit(1);

    if (enrollment) {
      return { hasAccess: true, reason: 'enrolled' };
    }

    // Check if instructor
    const [course] = await db
      .select()
      .from(courses)
      .where(eq(courses.id, mediaFile.courseId))
      .limit(1);

    if (course?.instructorId === appUser.id) {
      return { hasAccess: true, reason: 'instructor' };
    }
  }

  return { hasAccess: false, reason: 'not_authorized' };
}

// ---------------------------------------------------------
// Check if video URL is used in any FREE PREVIEW lesson
// ---------------------------------------------------------
async function isVideoInFreePreviewLesson(secureId: string): Promise<boolean> {
  try {
    // The video URL format is /api/media/{secureId}
    const videoUrlPattern = `/api/media/${secureId}`;
    
    // Check if any lesson content has this video URL AND is marked as free
    const freeLesson = await db
      .select({ id: lessonContent.id })
      .from(lessonContent)
      .where(
        and(
          eq(lessonContent.isFree, true),
          // Check if videoUrl contains the secureId
          // Using SQL LIKE for partial match
        )
      )
      .limit(1);

    // More precise check - get all free lessons and check video URLs
    const freeLessons = await db
      .select({ videoUrl: lessonContent.videoUrl })
      .from(lessonContent)
      .where(eq(lessonContent.isFree, true));

    for (const lesson of freeLessons) {
      if (lesson.videoUrl && lesson.videoUrl.includes(secureId)) {
        return true;
      }
    }

    return false;
  } catch (error) {
    console.error('Error checking free preview:', error);
    return false;
  }
}