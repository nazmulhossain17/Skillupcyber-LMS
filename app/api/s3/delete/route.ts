// app/api/s3/delete/route.ts
import { NextRequest, NextResponse } from "next/server";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { z } from "zod";
import { S3 } from "@/lib/S3Client";
import { auth } from "@/lib/auth";
import { app_users } from "@/db/schema";
import { eq } from "drizzle-orm";
import arcjet, { fixedWindow } from "@/lib/arcjet";
import { db } from "@/db/drizzle";

const deleteRequestSchema = z.object({
  key: z.string().min(1, "Key is required"),
});

const aj = arcjet.withRule(
  fixedWindow({
    mode: "LIVE",
    window: "1m",
    max: 10,
  })
);

// Helper to extract user ID from S3 key path
// Expected formats:
// - avatars/{userId}/filename.jpg
// - thumbnails/{userId}/filename.jpg  
// - videos/{userId}/filename.mp4
// - assignments/{userId}/filename.pdf
function extractUserIdFromKey(key: string): string | null {
  const parts = key.split('/');
  // Format: folder/userId/filename
  if (parts.length >= 3) {
    return parts[1];
  }
  return null;
}

export async function DELETE(request: NextRequest) {
  try {
    console.log("🗑️ [S3 Delete] Incoming request to delete file");

    // Authentication check
    const session = await auth.api.getSession({ headers: request.headers });
    if (!session?.user?.id) {
      console.error("❌ [S3 Delete] Unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = session.user.id;
    console.log("✅ [S3 Delete] User authenticated:", userId);

    // Rate limiting check
    const decision = await aj.protect(request, {
      fingerprint: userId,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        console.error("❌ [S3 Delete] Rate limit exceeded for user:", userId);
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            message: "You have made too many requests. Please try again later.",
          },
          { status: 429 }
        );
      }
      console.error("❌ [S3 Delete] Request denied:", decision.reason);
      return NextResponse.json(
        {
          error: "Request denied",
          message: "Your request has been blocked. Please try again later.",
        },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    console.log("📝 [S3 Delete] Request body:", body);

    const validation = deleteRequestSchema.safeParse(body);
    console.log("🔍 [S3 Delete] Validation result:", validation.success);

    if (!validation.success) {
      console.error("❌ [S3 Delete] Validation failed:", validation.error.format());
      return NextResponse.json(
        { error: "Invalid request body", details: validation.error.format() },
        { status: 400 }
      );
    }

    const { key } = validation.data;
    console.log("✅ [S3 Delete] Validated key:", key);

    // ============================================
    // OWNERSHIP VERIFICATION
    // ============================================
    
    // Get the app_user for the current session user
    const [appUser] = await db
      .select()
      .from(app_users)
      .where(eq(app_users.userId, userId))
      .limit(1);

    if (!appUser) {
      console.error("❌ [S3 Delete] App user not found for userId:", userId);
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const isAdmin = appUser.role === 'admin';
    console.log("👤 [S3 Delete] User role:", appUser.role, "isAdmin:", isAdmin);

    // Check ownership based on the S3 key path
    // Files are stored with user ID in the path: folder/userId/filename
    const keyOwnerId = extractUserIdFromKey(key);
    console.log("🔑 [S3 Delete] Extracted owner ID from key:", keyOwnerId);

    // For avatar files, also check the app_users table
    if (key.startsWith('avatars/')) {
      // Check if the key matches the user's current avatar
      // Extract the S3 key from the avatar URL if it's a full URL
      const userAvatarKey = appUser.avatar?.replace(/^https?:\/\/[^\/]+\//, '');
      const isOwnAvatar = userAvatarKey === key || keyOwnerId === appUser.id;
      
      if (!isOwnAvatar && !isAdmin) {
        console.error("❌ [S3 Delete] Permission denied - not owner of avatar");
        return NextResponse.json(
          { error: "Permission denied", message: "You can only delete your own files" },
          { status: 403 }
        );
      }
    } else {
      // For other files, verify ownership via the key path
      // The key should contain the user's appUser.id in the path
      if (keyOwnerId !== appUser.id && !isAdmin) {
        console.error("❌ [S3 Delete] Permission denied - key owner mismatch");
        console.error("   Key owner ID:", keyOwnerId);
        console.error("   Current user ID:", appUser.id);
        return NextResponse.json(
          { error: "Permission denied", message: "You can only delete your own files" },
          { status: 403 }
        );
      }
    }

    console.log("✅ [S3 Delete] Ownership verified");

    // ============================================
    // PROCEED WITH DELETION
    // ============================================

    const bucketName = process.env.AWS_S3_BUCKET_NAME || process.env.NEXT_PUBLIC_AWS_S3_BUCKET_NAME;
    const region = process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_REGION;

    console.log("🪣 [S3 Delete] Bucket name:", bucketName);
    console.log("🌍 [S3 Delete] Region:", region);

    if (!bucketName) {
      console.error("❌ [S3 Delete] AWS_S3_BUCKET_NAME is not set");
      return NextResponse.json(
        { error: "Server configuration error: S3 bucket not configured" },
        { status: 500 }
      );
    }

    if (!region) {
      console.error("❌ [S3 Delete] AWS_REGION is not set");
      return NextResponse.json(
        { error: "Server configuration error: AWS region not configured" },
        { status: 500 }
      );
    }

    // Create delete command
    const command = new DeleteObjectCommand({
      Bucket: bucketName,
      Key: key,
    });

    console.log("🗑️ [S3 Delete] Deleting object with key:", key);

    // Execute delete
    await S3.send(command);

    console.log("✅ [S3 Delete] File deleted successfully");

    // Return success response
    return NextResponse.json({
      status: "success",
      message: "File deleted successfully",
      key: key,
    });
  } catch (error) {
    console.error("❌ [S3 Delete] Error deleting file:", error);
    return NextResponse.json(
      {
        error: "Failed to delete file",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}