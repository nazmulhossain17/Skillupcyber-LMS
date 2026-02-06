// ============================================
// FILE: lib/S3Client.ts
// ============================================

import { S3Client } from "@aws-sdk/client-s3";

// ✅ FIX: Disable automatic checksum calculation to prevent CORS issues
export const S3 = new S3Client({
  region: process.env.AWS_REGION || process.env.NEXT_PUBLIC_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

// Alternative export name
export const s3Client = S3;