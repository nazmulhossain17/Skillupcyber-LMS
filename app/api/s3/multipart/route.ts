// ============================================
// FILE: app/api/s3/multipart/route.ts
// Multipart upload for large files (>100MB, up to 7GB)
// Required for video uploads that exceed single PUT limits
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { app_users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  S3Client,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
} from "@aws-sdk/client-s3";
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

// Part size: 100MB (must be at least 5MB for S3)
const PART_SIZE = 100 * 1024 * 1024;

// Max file size: 7GB
const MAX_FILE_SIZE = 7 * 1024 * 1024 * 1024;

// Allowed video types for multipart
const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/mpeg',
];

// Generate a safe filename
function generateSafeKey(originalName: string): string {
  const date = new Date().toISOString().split('T')[0];
  const uuid = uuidv4();
  const ext = originalName.split('.').pop()?.toLowerCase() || 'mp4';
  const baseName = originalName
    .replace(/\.[^/.]+$/, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50);
  
  return `uploads/videos/${date}/${uuid}-${baseName}.${ext}`;
}

// POST - Initialize multipart upload or get part URLs
export async function POST(req: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser || !['instructor', 'admin'].includes(appUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'init':
        return handleInit(body, appUser.id);
      case 'get-urls':
        return handleGetUrls(body);
      case 'complete':
        return handleComplete(body);
      case 'abort':
        return handleAbort(body);
      default:
        return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

  } catch (error: any) {
    console.error("Multipart upload error:", error);
    return NextResponse.json(
      { error: "Multipart upload failed", details: error.message },
      { status: 500 }
    );
  }
}

// Initialize multipart upload
async function handleInit(body: any, uploaderId: string) {
  const { fileName, fileType, fileSize } = body;

  if (!fileName || !fileType || !fileSize) {
    return NextResponse.json(
      { error: "fileName, fileType, and fileSize are required" },
      { status: 400 }
    );
  }

  if (!ALLOWED_VIDEO_TYPES.includes(fileType)) {
    return NextResponse.json(
      { error: `File type ${fileType} is not allowed for multipart upload` },
      { status: 400 }
    );
  }

  if (fileSize > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "File size exceeds 7GB limit" },
      { status: 400 }
    );
  }

  const key = generateSafeKey(fileName);

  // Create multipart upload
  const createCommand = new CreateMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    ContentType: fileType,
    Metadata: {
      'uploaded-by': uploaderId,
      'original-name': encodeURIComponent(fileName),
    },
  });

  const { UploadId } = await s3Client.send(createCommand);

  // Calculate number of parts
  const numParts = Math.ceil(fileSize / PART_SIZE);

  return NextResponse.json({
    success: true,
    uploadId: UploadId,
    key,
    partSize: PART_SIZE,
    numParts,
  });
}

// Get presigned URLs for parts
async function handleGetUrls(body: any) {
  const { key, uploadId, partNumbers } = body;

  if (!key || !uploadId || !partNumbers || !Array.isArray(partNumbers)) {
    return NextResponse.json(
      { error: "key, uploadId, and partNumbers are required" },
      { status: 400 }
    );
  }

  // Generate presigned URLs for each part (max 100 at a time)
  const urls: { partNumber: number; url: string }[] = [];

  for (const partNumber of partNumbers.slice(0, 100)) {
    const command = new UploadPartCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    urls.push({ partNumber, url });
  }

  return NextResponse.json({
    success: true,
    urls,
  });
}

// Complete multipart upload
async function handleComplete(body: any) {
  const { key, uploadId, parts } = body;

  if (!key || !uploadId || !parts || !Array.isArray(parts)) {
    return NextResponse.json(
      { error: "key, uploadId, and parts are required" },
      { status: 400 }
    );
  }

  // Validate parts format
  const validParts = parts.every(
    (p: any) => typeof p.PartNumber === 'number' && typeof p.ETag === 'string'
  );

  if (!validParts) {
    return NextResponse.json(
      { error: "Invalid parts format. Each part needs PartNumber and ETag" },
      { status: 400 }
    );
  }

  // Sort parts by part number
  const sortedParts = [...parts].sort((a, b) => a.PartNumber - b.PartNumber);

  const completeCommand = new CompleteMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
    MultipartUpload: {
      Parts: sortedParts,
    },
  });

  const result = await s3Client.send(completeCommand);

  const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${key}`;

  return NextResponse.json({
    success: true,
    location: result.Location,
    publicUrl,
    key,
  });
}

// Abort multipart upload
async function handleAbort(body: any) {
  const { key, uploadId } = body;

  if (!key || !uploadId) {
    return NextResponse.json(
      { error: "key and uploadId are required" },
      { status: 400 }
    );
  }

  const abortCommand = new AbortMultipartUploadCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    UploadId: uploadId,
  });

  await s3Client.send(abortCommand);

  return NextResponse.json({
    success: true,
    message: "Upload aborted",
  });
}