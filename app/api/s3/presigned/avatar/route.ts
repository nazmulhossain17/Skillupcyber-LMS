// ============================================
// FILE: app/api/s3/presigned/avatar/route.ts
// Generate presigned URLs for avatar uploads
// Allows ALL authenticated users (not just instructors)
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
const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

const ALLOWED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png', 
  'image/gif',
  'image/webp',
];

// POST - Generate presigned URL for avatar upload
export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get app_user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const body = await req.json();
    const { fileName, fileType, fileSize } = body;

    if (!fileName || !fileType) {
      return NextResponse.json(
        { error: "fileName and fileType are required" },
        { status: 400 }
      );
    }

    // Check if file type is allowed
    if (!ALLOWED_IMAGE_TYPES.includes(fileType)) {
      return NextResponse.json(
        { error: `File type ${fileType} is not allowed. Use JPG, PNG, GIF, or WebP.` },
        { status: 400 }
      );
    }

    // Check file size if provided
    if (fileSize && fileSize > MAX_AVATAR_SIZE) {
      return NextResponse.json(
        { error: "File size exceeds maximum allowed (5MB)" },
        { status: 400 }
      );
    }

    // Generate S3 key for avatar
    const ext = fileName.split('.').pop()?.toLowerCase() || 'jpg';
    const key = `avatars/${appUser.id}/${uuidv4()}.${ext}`;

    // Create presigned URL for PUT
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      ContentType: fileType,
      Metadata: {
        'uploaded-by': appUser.id,
        'original-name': encodeURIComponent(fileName),
        'upload-type': 'avatar',
      },
    });

    // Generate presigned URL (valid for 10 minutes)
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 600,
    });

    // Generate the final public URL
    const publicUrl = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'ap-southeast-2'}.amazonaws.com/${key}`;

    return NextResponse.json({
      success: true,
      uploadUrl: presignedUrl,  // For compatibility with profile page
      presignedUrl,             // Original field name
      fileUrl: publicUrl,       // For compatibility with profile page  
      publicUrl,                // Original field name
      key,
      expiresIn: 600,
    });

  } catch (error: unknown) {
    console.error("Avatar presigned URL error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to generate upload URL", details: message },
      { status: 500 }
    );
  }
}