// ============================================
// FILE: app/api/s3/upload/secure/route.ts
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { db } from '@/db/drizzle';
import { app_users, media_files } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const s3Client = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const MAX_FILE_SIZES: Record<string, number> = {
  image: 10 * 1024 * 1024,
  video: 500 * 1024 * 1024,
  document: 50 * 1024 * 1024,
  audio: 100 * 1024 * 1024,
};

const ALLOWED_TYPES: Record<string, string[]> = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  video: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'],
  document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
};

function generateSecureId(): string {
  return crypto.randomBytes(32).toString('hex');
}

function getFileCategory(mimeType: string): string {
  for (const [category, types] of Object.entries(ALLOWED_TYPES)) {
    if (types.includes(mimeType)) return category;
  }
  return 'unknown';
}

export async function POST(req: NextRequest) {
  console.log('\n========== SECURE UPLOAD ==========');

  try {
    // 1. Auth check
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Get app user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, session.user.id))
      .limit(1);

    if (!appUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // 3. Parse form data
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (e: any) {
      console.error('FormData parse error:', e);
      return NextResponse.json({
        error: 'Invalid request format',
        details: 'Expected multipart/form-data. Do not set Content-Type header manually.',
      }, { status: 400 });
    }

    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'uploads';
    const fileType = (formData.get('type') as string) || 'image';
    const courseId = formData.get('courseId') as string | null;
    const isPublic = formData.get('public') === 'true';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('📄 File:', file.name, file.type, file.size);

    // 4. Validate
    const allowedMimes = ALLOWED_TYPES[fileType] || ALLOWED_TYPES.image;
    if (!allowedMimes.includes(file.type)) {
      return NextResponse.json({
        error: `Invalid file type: ${file.type}`,
        allowed: allowedMimes,
      }, { status: 400 });
    }

    const maxSize = MAX_FILE_SIZES[fileType] || MAX_FILE_SIZES.image;
    if (file.size > maxSize) {
      return NextResponse.json({
        error: `File too large. Max: ${Math.round(maxSize / 1024 / 1024)}MB`,
      }, { status: 400 });
    }

    // 5. Generate IDs
    const secureId = generateSecureId();
    const internalId = uuidv4();
    const fileExtension = file.name.split('.').pop()?.toLowerCase() || 'bin';
    const date = new Date().toISOString().split('T')[0];
    const s3Key = `${folder}/${date}/${internalId}.${fileExtension}`;

    // 6. Upload to S3
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

    await s3Client.send(new PutObjectCommand({
      Bucket: process.env.AWS_S3_BUCKET_NAME!,
      Key: s3Key,
      Body: buffer,
      ContentType: file.type,
      ServerSideEncryption: 'AES256',
    }));

    console.log('✅ S3 upload complete:', s3Key);

    // 7. Save to database
    await db.insert(media_files).values({
      id: uuidv4(),
      secureId,
      s3Key,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      category: getFileCategory(file.type),
      fileHash,
      uploadedBy: appUser.id,
      courseId: courseId || null,
      isPublic,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // 8. Return secure URL
    const secureUrl = `/api/media/${secureId}`;

    return NextResponse.json({
      success: true,
      id: secureId,
      url: secureUrl,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    return NextResponse.json({
      error: 'Upload failed',
      details: error.message,
    }, { status: 500 });
  }
}