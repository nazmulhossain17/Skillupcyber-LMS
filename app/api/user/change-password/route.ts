// app/api/user/change-password/route.ts
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { db } from "@/db/drizzle";
import { account } from "@/db/schema";
import { eq } from "drizzle-orm";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  confirmPassword: z.string().min(1, "Please confirm your password"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export async function POST(req: NextRequest) {
  try {
    console.log('🔐 Password change request received');

    // Check authentication
    const session = await auth.api.getSession({ headers: req.headers });
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await req.json();
    const validation = changePasswordSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { 
          error: "Validation failed", 
          details: validation.error.flatten().fieldErrors 
        },
        { status: 400 }
      );
    }

    const { currentPassword, newPassword } = validation.data;

    // Get user's password from account table
    const [userAccount] = await db
      .select()
      .from(account)
      .where(eq(account.userId, session.user.id))
      .limit(1);

    if (!userAccount || !userAccount.password) {
      return NextResponse.json(
        { error: "No password found for this account" },
        { status: 400 }
      );
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      userAccount.password
    );

    if (!isValidPassword) {
      return NextResponse.json(
        { error: "Current password is incorrect" },
        { status: 400 }
      );
    }

    // Check if new password is same as current
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: "New password must be different from current password" },
        { status: 400 }
      );
    }

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in account table
    await db
      .update(account)
      .set({ 
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(account.userId, session.user.id));

    console.log('✅ Password changed successfully for user:', session.user.id);

    return NextResponse.json({
      message: "Password changed successfully",
    });

  } catch (error) {
    console.error("❌ Change Password Error:", error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation failed", details: error.flatten() },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to change password" },
      { status: 500 }
    );
  }
}