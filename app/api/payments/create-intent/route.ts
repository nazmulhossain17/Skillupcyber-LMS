// app/api/payments/create-intent/route.ts
// PRODUCTION-READY with MAXIMUM SECURITY
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db/drizzle";
import { courses, app_users, payments, enrollments } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { stripe, formatAmountForStripe } from "@/lib/stripe";
import arcjet, { fixedWindow } from "@/lib/arcjet";
import { headers } from "next/headers";

// ========================================
// SECURITY LAYER 1: Arcjet Protection
// ========================================
const aj = arcjet.withRule(
  // Rate limiting - prevent brute force
  fixedWindow({
    mode: "LIVE",
    window: "1m",
    max: 3, // Only 3 payment attempts per minute (stricter)
  })
);

// ========================================
// SECURITY LAYER 2: Input Validation
// ========================================
const createPaymentIntentSchema = z.object({
  courseId: z.string().uuid("Invalid course ID"),
  // Additional security: Verify price on backend (never trust frontend)
  expectedPrice: z.number().positive().optional(),
});

// ========================================
// SECURITY LAYER 3: Idempotency Key Generation
// ========================================
function generateIdempotencyKey(userId: string, courseId: string): string {
  // Prevents duplicate payments if user clicks multiple times
  const timestamp = Math.floor(Date.now() / 60000); // 1-minute window
  return `payment_${userId}_${courseId}_${timestamp}`;
}

// ========================================
// POST - Create Payment Intent
// ========================================
export async function POST(req: NextRequest) {
  try {
    // SECURITY: Get real IP address (handles proxies/CDN)
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    const realIp = forwarded ? forwarded.split(",")[0] : headersList.get("x-real-ip");
    
    console.log("🔒 Payment request from IP:", realIp);

    // SECURITY LAYER 1: Auth check (must be authenticated)
    const session = await auth.api.getSession({
      headers: req.headers,
    });

    if (!session?.user?.id) {
      console.warn("⚠️ Unauthorized payment attempt from IP:", realIp);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // SECURITY: Verify email is verified (if required)
    if (!session.user.emailVerified) {
      console.warn("⚠️ Unverified email payment attempt:", session.user.email);
      return NextResponse.json(
        { error: "Please verify your email before making a purchase" },
        { status: 403 }
      );
    }

    // SECURITY LAYER 2: Arcjet protection
    const decision = await aj.protect(req, {
      fingerprint: session.user.id,
    });

    if (decision.isDenied()) {
      if (decision.reason.isRateLimit()) {
        console.warn("⚠️ Rate limit exceeded:", session.user.id);
        return NextResponse.json(
          { 
            error: "Too many payment attempts. Please wait before trying again.",
            retryAfter: 60 
          },
          { status: 429 }
        );
      }

      if (decision.reason.isBot()) {
        console.warn("⚠️ Bot detected:", session.user.id);
        return NextResponse.json(
          { error: "Automated requests are not allowed" },
          { status: 403 }
        );
      }

      console.warn("⚠️ Request blocked by Shield:", session.user.id);
      return NextResponse.json(
        { error: "Request blocked for security reasons" },
        { status: 403 }
      );
    }

    // SECURITY LAYER 3: Input validation
    const body = await req.json();
    const parsed = createPaymentIntentSchema.safeParse(body);

    if (!parsed.success) {
      console.warn("⚠️ Invalid payment data:", parsed.error.format());
      return NextResponse.json(
        { error: "Invalid request data", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { courseId, expectedPrice } = parsed.data;

    // SECURITY LAYER 4: Database transaction (atomic operations)
    const result = await db.transaction(async (tx) => {
      // Get and verify app_user
      const [appUser] = await tx
        .select()
        .from(app_users)
        .where(eq(app_users.userId, session.user.id))
        .limit(1);

      if (!appUser) {
        throw new Error("SECURITY_ERROR: Profile not found");
      }

      // SECURITY: Check if user is banned/inactive
      if (!appUser.isActive) {
        throw new Error("SECURITY_ERROR: Account is inactive");
      }

      // Get and verify course
      const [course] = await tx
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      if (!course) {
        throw new Error("Course not found");
      }

      if (!course.published) {
        throw new Error("Course is not available for purchase");
      }

      // SECURITY: Verify course price matches expected (prevent price manipulation)
      const actualPrice = course.discountPrice && Number(course.discountPrice) > 0
        ? Number(course.discountPrice)
        : Number(course.price);

      if (expectedPrice && Math.abs(expectedPrice - actualPrice) > 0.01) {
        console.error("🚨 PRICE MANIPULATION DETECTED:", {
          expected: expectedPrice,
          actual: actualPrice,
          user: session.user.id,
          course: courseId,
        });
        throw new Error("SECURITY_ERROR: Price mismatch detected");
      }

      if (actualPrice <= 0) {
        throw new Error("This course is free. No payment required.");
      }

      // SECURITY: Check if already enrolled (prevent duplicate purchases)
      const [existingEnrollment] = await tx
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.appUserId, appUser.id),
            eq(enrollments.courseId, courseId)
          )
        )
        .limit(1);

      if (existingEnrollment) {
        throw new Error("You are already enrolled in this course");
      }

      // SECURITY: Check for pending payments (prevent duplicate payment intents)
      const [pendingPayment] = await tx
        .select()
        .from(payments)
        .where(
          and(
            eq(payments.appUserId, appUser.id),
            eq(payments.courseId, courseId),
            eq(payments.status, "pending")
          )
        )
        .limit(1);

      if (pendingPayment) {
        // Return existing payment intent instead of creating new one
        const existingIntent = await stripe.paymentIntents.retrieve(
          pendingPayment.stripePaymentIntentId
        );

        if (existingIntent.status === "requires_payment_method") {
          return {
            clientSecret: existingIntent.client_secret,
            paymentId: pendingPayment.id,
            amount: actualPrice,
            existing: true,
          };
        }
      }

      const amountInCents = formatAmountForStripe(actualPrice);

      // Create or retrieve Stripe customer
      let customerId = appUser.stripeCustomerId;

      if (!customerId) {
        // SECURITY: Create customer with metadata for audit trail
        const customer = await stripe.customers.create({
          email: session.user.email!,
          name: session.user.name || undefined,
          metadata: {
            userId: session.user.id,
            appUserId: appUser.id,
            createdAt: new Date().toISOString(),
            ipAddress: realIp || "unknown",
          },
        });

        customerId = customer.id;

        await tx
          .update(app_users)
          .set({ stripeCustomerId: customerId })
          .where(eq(app_users.id, appUser.id));
      }

      // SECURITY: Generate idempotency key to prevent duplicate charges
      const idempotencyKey = generateIdempotencyKey(session.user.id, courseId);

      // Create Stripe Payment Intent with security settings
      const paymentIntent = await stripe.paymentIntents.create(
        {
          amount: amountInCents,
          currency: "usd",
          customer: customerId,
          metadata: {
            courseId: course.id,
            userId: session.user.id,
            appUserId: appUser.id,
            courseTitle: course.title,
            userEmail: session.user.email!,
            createdAt: new Date().toISOString(),
            ipAddress: realIp || "unknown",
          },
          description: `Course Purchase: ${course.title}`,
          // SECURITY: Additional Stripe security features
          automatic_payment_methods: {
            enabled: true,
            allow_redirects: "never", // Prevent redirect-based attacks
          },
          // SECURITY: 3D Secure 2 (Strong Customer Authentication)
          payment_method_options: {
            card: {
              request_three_d_secure: "automatic", // Enforce 3DS when needed
            },
          },
          // SECURITY: Set statement descriptor to prevent confusion
          statement_descriptor: "COURSE PURCHASE",
          statement_descriptor_suffix: course.title.substring(0, 22),
        },
        {
          idempotencyKey, // Prevent duplicate charges
        }
      );

      // Create payment record with full audit trail
      const [payment] = await tx
        .insert(payments)
        .values({
          appUserId: appUser.id,
          courseId: course.id,
          stripePaymentIntentId: paymentIntent.id,
          stripeCustomerId: customerId,
          amount: actualPrice.toFixed(2),
          currency: "usd",
          status: "pending",
          metadata: {
            courseTitle: course.title,
            courseSlug: course.slug,
            userEmail: session.user.email,
            ipAddress: realIp || "unknown",
            userAgent: req.headers.get("user-agent") || "unknown",
            createdAt: new Date().toISOString(),
          },
        })
        .returning();

      // SECURITY: Log payment creation for audit
      console.log("✅ Payment intent created:", {
        paymentId: payment.id,
        userId: session.user.id,
        courseId: course.id,
        amount: actualPrice,
        ip: realIp,
      });

      return {
        clientSecret: paymentIntent.client_secret,
        paymentId: payment.id,
        amount: actualPrice,
        existing: false,
      };
    });

    return NextResponse.json({
      success: true,
      ...result,
      currency: "usd",
    });
  } catch (error: any) {
    console.error("❌ Payment creation error:", error);

    // SECURITY: Don't expose internal errors to client
    if (error.message.startsWith("SECURITY_ERROR:")) {
      const message = error.message.replace("SECURITY_ERROR: ", "");
      return NextResponse.json({ error: message }, { status: 403 });
    }

    // Handle known user-facing errors
    if (error.message === "Profile not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message === "Course not found") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error.message.includes("already enrolled")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (error.message.includes("free")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error.message.includes("not available")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Handle Stripe errors
    if (error.type === "StripeCardError") {
      return NextResponse.json(
        { error: "Payment failed", details: error.message },
        { status: 402 }
      );
    }

    if (error.type === "StripeInvalidRequestError") {
      console.error("🚨 Stripe invalid request:", error);
      return NextResponse.json(
        { error: "Invalid payment request" },
        { status: 400 }
      );
    }

    // Generic error (don't expose details)
    return NextResponse.json(
      { error: "Payment creation failed. Please try again." },
      { status: 500 }
    );
  }
}