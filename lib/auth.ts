// ============================================
// FILE: lib/auth.ts
// Better Auth configuration with Resend email
// ============================================

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db/drizzle";
import { schema } from "@/db/schema";
import { nextCookies } from "better-auth/next-js";
import { Resend } from "resend";
import { render } from "@react-email/components";
import ForgotPasswordEmail from "@/components/email/reset-password";

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

export const auth = betterAuth({
    database: drizzleAdapter(db, {
        provider: "pg",
        schema: schema
    }),
    socialProviders: {
        google: { 
            clientId: process.env.GOOGLE_CLIENT_ID as string, 
            clientSecret: process.env.GOOGLE_CLIENT_SECRET as string, 
        }, 
        github: { 
            clientId: process.env.GITHUB_CLIENT_ID as string, 
            clientSecret: process.env.GITHUB_CLIENT_SECRET as string, 
        }, 
    },
    emailAndPassword: {
        enabled: true,
        autoSignIn: false,
        // Password reset configuration
        sendResetPassword: async ({ user, url }) => {
            try {
                const emailHtml = await render(
                    ForgotPasswordEmail({
                        userEmail: user.email,
                        resetUrl: url,
                    })
                );

                await resend.emails.send({
                    from: process.env.EMAIL_FROM || "EduPro <noreply@yourdomain.com>",
                    to: user.email,
                    subject: "Reset Your Password - EduPro",
                    html: emailHtml,
                });

                console.log("✅ Password reset email sent to:", user.email);
            } catch (error) {
                console.error("❌ Failed to send password reset email:", error);
                throw new Error("Failed to send password reset email");
            }
        },
    },
    plugins: [nextCookies()]
});