// ============================================
// FILE: app/api/files/download/route.ts
// Secure file download - generates pre-signed URL or streams file
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { app_users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize S3 client
const s3Client = new S3Client({
  region: process.env.AWS_REGION || "ap-southeast-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || "eduzpro";

// Extract S3 key from full URL
function extractS3Key(url: string): string | null {
  try {
    // Handle full S3 URL: https://bucket.s3.region.amazonaws.com/path/to/file
    // Or: https://s3.region.amazonaws.com/bucket/path/to/file
    const urlObj = new URL(url);
    
    // Remove leading slash and decode URI components
    let key = decodeURIComponent(urlObj.pathname);
    
    // Remove leading slash
    if (key.startsWith('/')) {
      key = key.substring(1);
    }
    
    // If bucket name is in path (s3.region.amazonaws.com/bucket/key format)
    if (key.startsWith(BUCKET_NAME + '/')) {
      key = key.substring(BUCKET_NAME.length + 1);
    }
    
    return key || null;
  } catch {
    // If not a valid URL, assume it's already a key
    return url;
  }
}

// GET - Generate pre-signed URL for secure download
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const fileUrl = searchParams.get("url");
    const fileKey = searchParams.get("key");
    const fileName = searchParams.get("name") || "download";
    const download = searchParams.get("download") === "true";

    if (!fileUrl && !fileKey) {
      return NextResponse.json(
        { error: "File URL or key is required" },
        { status: 400 }
      );
    }

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

    // Extract S3 key from URL or use provided key
    const s3Key = fileKey || extractS3Key(fileUrl!);
    
    if (!s3Key) {
      return NextResponse.json(
        { error: "Could not determine file key" },
        { status: 400 }
      );
    }

    // Create GetObject command
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      // Force download if requested
      ...(download && {
        ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
      }),
    });

    // Generate pre-signed URL (valid for 1 hour)
    const presignedUrl = await getSignedUrl(s3Client, command, {
      expiresIn: 3600, // 1 hour
    });

    // Option 1: Return the pre-signed URL (client redirects)
    return NextResponse.json({
      success: true,
      url: presignedUrl,
      expiresIn: 3600,
    });

  } catch (error: any) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to generate download URL", details: error.message },
      { status: 500 }
    );
  }
}

// POST - Stream file directly (alternative method)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url, key, name } = body;

    if (!url && !key) {
      return NextResponse.json(
        { error: "File URL or key is required" },
        { status: 400 }
      );
    }

    // Auth check
    const session = await auth.api.getSession({ headers: req.headers });
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract S3 key
    const s3Key = key || extractS3Key(url);
    
    if (!s3Key) {
      return NextResponse.json(
        { error: "Could not determine file key" },
        { status: 400 }
      );
    }

    // Get object from S3
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });

    const response = await s3Client.send(command);
    
    if (!response.Body) {
      return NextResponse.json(
        { error: "File not found" },
        { status: 404 }
      );
    }

    // Convert stream to array buffer
    const chunks: Uint8Array[] = [];
    const reader = response.Body.transformToWebStream().getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    const buffer = Buffer.concat(chunks);

    // Return file with proper headers
    const fileName = name || s3Key.split('/').pop() || 'download';
    const contentType = response.ContentType || 'application/octet-stream';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'private, max-age=3600',
      },
    });

  } catch (error: any) {
    console.error("Stream error:", error);
    return NextResponse.json(
      { error: "Failed to download file", details: error.message },
      { status: 500 }
    );
  }
}