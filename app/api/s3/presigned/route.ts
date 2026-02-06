// ============================================
// FILE: app/api/s3/presigned/route.ts
// Generate presigned URLs for direct browser-to-S3 uploads
// Supports files up to 5TB (S3's limit)
// Bypasses Vercel's 4.5MB payload limit
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { app_users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { v4 as uuidv4 } from "uuid";

const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "eduzpro";

// Allowed file types and their max sizes
const FILE_CONFIGS: Record<string, { maxSize: number; folder: string }> = {
  // Videos - up to 7GB
  'video/mp4': { maxSize: 7 * 1024 * 1024 * 1024, folder: 'videos' },
  'video/webm': { maxSize: 7 * 1024 * 1024 * 1024, folder: 'videos' },
  'video/quicktime': { maxSize: 7 * 1024 * 1024 * 1024, folder: 'videos' },
  'video/x-msvideo': { maxSize: 7 * 1024 * 1024 * 1024, folder: 'videos' },
  'video/x-matroska': { maxSize: 7 * 1024 * 1024 * 1024, folder: 'videos' },
  
  // Images - up to 50MB
  'image/jpeg': { maxSize: 50 * 1024 * 1024, folder: 'images' },
  'image/png': { maxSize: 50 * 1024 * 1024, folder: 'images' },
  'image/gif': { maxSize: 50 * 1024 * 1024, folder: 'images' },
  'image/webp': { maxSize: 50 * 1024 * 1024, folder: 'images' },
  'image/svg+xml': { maxSize: 10 * 1024 * 1024, folder: 'images' },
  
  // Documents - up to 100MB
  'application/pdf': { maxSize: 100 * 1024 * 1024, folder: 'documents' },
  'application/msword': { maxSize: 100 * 1024 * 1024, folder: 'documents' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { maxSize: 100 * 1024 * 1024, folder: 'documents' },
  'application/vnd.ms-excel': { maxSize: 100 * 1024 * 1024, folder: 'documents' },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { maxSize: 100 * 1024 * 1024, folder: 'documents' },
  'application/vnd.ms-powerpoint': { maxSize: 100 * 1024 * 1024, folder: 'documents' },
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': { maxSize: 100 * 1024 * 1024, folder: 'documents' },
  'text/plain': { maxSize: 10 * 1024 * 1024, folder: 'documents' },
  'application/zip': { maxSize: 500 * 1024 * 1024, folder: 'documents' },
  'application/x-rar-compressed': { maxSize: 500 * 1024 * 1024, folder: 'documents' },
  
  // Audio - up to 500MB
  'audio/mpeg': { maxSize: 500 * 1024 * 1024, folder: 'audio' },
  'audio/wav': { maxSize: 500 * 1024 * 1024, folder: 'audio' },
  'audio/ogg': { maxSize: 500 * 1024 * 1024, folder: 'audio' },
  'audio/webm': { maxSize: 500 * 1024 * 1024, folder: 'audio' },
};

// Generate a safe filename
function generateSafeKey(originalName: string, folder: string): string {
  const date = new Date().toISOString().split('T')[0];
  const uuid = uuidv4();
  
  // Clean the filename
  const ext = originalName.split('.').pop()?.toLowerCase() || '';
  const baseName = originalName
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9_-]/g, '_') // Replace special chars
    .substring(0, 50); // Limit length
  
  return `uploads/${folder}/${date}/${uuid}-${baseName}.${ext}`;
}

// POST - Generate presigned URL for upload
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get app_user and check role
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Only instructors and admins can upload large files
    if (!['instructor', 'admin'].includes(appUser.role)) {
      return NextResponse.json(
        { error: "Only instructors can upload files" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { fileName, fileType, fileSize } = body;

    if (!fileName || !fileType || !fileSize) {
      return NextResponse.json(
        { error: "fileName, fileType, and fileSize are required" },
        { status: 400 }
      );
    }

    // Check if file type is allowed
    const config = FILE_CONFIGS[fileType];
    if (!config) {
      return NextResponse.json(
        { error: `File type ${fileType} is not allowed` },
        { status: 400 }
      );
    }

    // Check file size
    if (fileSize > config.maxSize) {
      const maxSizeMB = Math.round(config.maxSize / (1024 * 1024));
      return NextResponse.json(
        { error: `File size exceeds maximum allowed (${maxSizeMB}MB for ${fileType})` },
        { status: 400 }
      );
    }

    // Generate S3 key
    const key = generateSafeKey(fileName, config.folder);

    // Create presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      // Add metadata
      Metadata: {
        'uploaded-by': appUser.id,
        'original-name': encodeURIComponent(fileName),
      },
    });

    // Generate presigned URL (valid for 1 hour)
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600,
    });

    // Generate the final public URL
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      presignedUrl,
      key,
      publicUrl,
      expiresIn: 3600,
    });

  } catch (error: any) {
    console.error("Presigned URL error:", error);
    return NextResponse.json(
      { error: "Failed to generate upload URL", details: error.message },
      { status: 500 }
    );
  }
}