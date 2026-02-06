// ============================================
// FILE: app/api/s3/upload/route.ts
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { z } from "zod";
import { S3 } from "@/lib/S3Client";
import { auth } from "@/lib/auth";
import arcjet, { fixedWindow } from "@/lib/arcjet";

const uploadRequestSchema = z.object({
  filename: z.string(),
  contentType: z.string(),
  size: z.number().positive(),
});

const aj = arcjet.withRule(
  fixedWindow({
    mode: "LIVE",
    window: "1m",
    max: 10, // Increased for better UX
  })
);

export async function POST(request: NextRequest) {
  try {
    console.log("📤 [S3 Upload] Incoming request to generate presigned URL");

    // Authentication check
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      console.error("❌ [S3 Upload] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("✅ [S3 Upload] User authenticated:", session.user.id);

    // Rate limiting check
    const decision = await aj.protect(request, {
      fingerprint: session.user.id,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        console.error("❌ [S3 Upload] Rate limit exceeded for user:", session.user.id);
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            message: "You have made too many requests. Please try again later.",
          },
          { status: 429 }
        );
      }
      console.error("❌ [S3 Upload] Request denied:", decision.reason);
      return NextResponse.json(
        {
          error: "Request denied",
          message: "Your request has been blocked. Please try again later.",
        },
        { status: 403 }
      );
    }

    // Request is allowed - continue processing
    const body = await request.json();
    console.log("📝 [S3 Upload] Request body:", body);

    const validation = uploadRequestSchema.safeParse(body);
    console.log("🔍 [S3 Upload] Validation result:", validation.success);

    if (!validation.success) {
      console.error("❌ [S3 Upload] Validation failed:", validation.error.format());
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { filename, contentType } = validation.data;
    // NOTE: We don't use 'size' in the command anymore - it causes CORS issues
    console.log("✅ [S3 Upload] Validated data:", { filename, contentType });

    const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_REGION;

    console.log("🪣 [S3 Upload] Bucket name:", bucketName);
    console.log("🌍 [S3 Upload] Region:", region);

    if (!bucketName) {
      console.error("❌ [S3 Upload] AWS_S3_BUCKET_NAME is not set");
      return NextResponse.json(
        { error: "Server configuration error: S3 bucket not configured" },
        { status: 500 }
      );
    }

    if (!region) {
      console.error("❌ [S3 Upload] AWS_REGION is not set");
      return NextResponse.json(
        { error: "Server configuration error: AWS region not configured" },
        { status: 500 }
      );
    }

    // Generate unique key with timestamp for better organization
    const timestamp = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const uniqueId = uuidv4();
    const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_');
    const uniqueKey = `uploads/videos/${timestamp}/${uniqueId}-${sanitizedFilename}`;

    console.log("🔑 [S3 Upload] Generated unique S3 key:", uniqueKey);

    // ✅ FIX: Don't include ContentLength - it causes signature mismatch
    // ✅ FIX: Only include ContentType
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: uniqueKey,
      ContentType: contentType,
      // 👇 THIS IS CRITICAL
      // ChecksumAlgorithm: undefined,
    });

    console.log("📦 [S3 Upload] PutObjectCommand created");

    // ✅ FIX: Generate presigned URL without checksum headers
    const presignedUrl = await getSignedUrl(S3, command, {
      expiresIn: 3600, // 1 hour for large video uploads
    });

    console.log("✅ [S3 Upload] Generated presigned URL successfully");

    const fileUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${uniqueKey}`;

    return NextResponse.json({
      presignedUrl,
      key: uniqueKey,
      url: fileUrl,
    });
  } catch (error) {
    console.error("❌ [S3 Upload] Error generating presigned URL:", error);
    return NextResponse.json(
      {
        error: "Failed to generate upload URL",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}