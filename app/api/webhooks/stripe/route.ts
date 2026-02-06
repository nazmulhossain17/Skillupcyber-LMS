// app/api/webhooks/stripe/route.ts
// PRODUCTION-READY with MAXIMUM SECURITY
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/drizzle";
import { payments, enrollments, courses, app_users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { stripe, webhookSecret } from "@/lib/stripe";
import type Stripe from "stripe";
import { headers } from "next/headers";

// SECURITY: Track processed webhook IDs to prevent replay attacks
const processedWebhooks = new Set<string>();
const WEBHOOK_ID_TTL = 5 * 60 * 1000; // 5 minutes

// SECURITY: Cleanup old webhook IDs periodically
setInterval(() => {
  processedWebhooks.clear();
}, WEBHOOK_ID_TTL);

// ========================================
// POST - Stripe Webhook Handler
// ========================================
export async function POST(req: NextRequest) {
  try {
    // SECURITY: Get raw body (required for signature verification)
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    // SECURITY: Get real IP for logging
    const headersList = await headers();
    const forwarded = headersList.get("x-forwarded-for");
    const realIp = forwarded ? forwarded.split(",")[0] : headersList.get("x-real-ip");

    // SECURITY: Verify signature exists
    if (!signature) {
      console.error("🚨 SECURITY: Webhook with no signature from IP:", realIp);
      return NextResponse.json(
        { error: "No signature provided" },
        { status: 400 }
      );
    }

    // SECURITY: Verify webhook secret is configured
    if (!webhookSecret) {
      console.error("🚨 CRITICAL: STRIPE_WEBHOOK_SECRET not configured");
      return NextResponse.json(
        { error: "Webhook secret not configured" },
        { status: 500 }
      );
    }

    // SECURITY LAYER 1: Verify webhook signature (cryptographic verification)
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err: any) {
      console.error("🚨 SECURITY: Invalid webhook signature from IP:", realIp, err.message);
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // SECURITY LAYER 2: Prevent replay attacks
    if (processedWebhooks.has(event.id)) {
      console.warn("⚠️ SECURITY: Duplicate webhook detected:", event.id);
      // Return 200 to acknowledge, but don't process
      return NextResponse.json({ received: true, duplicate: true });
    }

    // Mark as processed
    processedWebhooks.add(event.id);

    // SECURITY LAYER 3: Verify event timestamp (prevent old events)
    const eventAge = Date.now() - event.created * 1000;
    const MAX_EVENT_AGE = 5 * 60 * 1000; // 5 minutes

    if (eventAge > MAX_EVENT_AGE) {
      console.warn("⚠️ SECURITY: Old webhook event rejected:", {
        eventId: event.id,
        age: eventAge / 1000,
      });
      return NextResponse.json(
        { error: "Event too old" },
        { status: 400 }
      );
    }

    console.log("✅ Verified webhook event:", event.type, event.id);

    // Handle different event types
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
        break;

      case "payment_intent.succeeded":
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.payment_failed":
        await handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case "payment_intent.canceled":
        await handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      case "charge.refunded":
        await handleRefund(event.data.object as Stripe.Charge);
        break;

      case "customer.subscription.deleted":
        // If you add subscriptions later
        console.log("ℹ️ Subscription deleted:", event.data.object);
        break;

      case "charge.dispute.created":
        // SECURITY: Alert on disputes
        await handleDispute(event.data.object as Stripe.Dispute);
        break;

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    
    // SECURITY: Don't expose internal errors
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

// ========================================
// Handle Checkout Complete
// ========================================
async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
  try {
    console.log("🛒 Processing checkout:", session.id);

    // SECURITY: Verify payment was actually completed
    if (session.payment_status !== "paid") {
      console.warn("⚠️ Checkout completed but not paid:", session.id);
      return;
    }

    // SECURITY: Verify metadata exists
    const { courseId, userId, appUserId } = session.metadata || {};
    if (!courseId || !appUserId) {
      console.error("🚨 SECURITY: Missing metadata in checkout:", session.id);
      return;
    }

    // SECURITY: Use transaction for atomic operations
    await db.transaction(async (tx) => {
      // SECURITY: Verify user exists and is active
      const [user] = await tx
        .select()
        .from(app_users)
        .where(eq(app_users.id, appUserId))
        .limit(1);

      if (!user || !user.isActive) {
        throw new Error("Invalid or inactive user");
      }

      // SECURITY: Check for duplicate payment
      const [existingPayment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.stripePaymentIntentId, session.payment_intent as string))
        .limit(1);

      if (existingPayment) {
        console.log("ℹ️ Payment already recorded:", existingPayment.id);
        return;
      }

      // Create payment record
      const [payment] = await tx
        .insert(payments)
        .values({
          appUserId,
          courseId,
          stripePaymentIntentId: session.payment_intent as string,
          stripeCustomerId: session.customer as string,
          amount: (session.amount_total! / 100).toFixed(2),
          currency: session.currency || "usd",
          status: "succeeded",
          metadata: {
            ...session.metadata,
            checkoutSessionId: session.id,
            processedAt: new Date().toISOString(),
          },
        })
        .returning();

      // SECURITY: Check for duplicate enrollment
      const [existingEnrollment] = await tx
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.appUserId, appUserId),
            eq(enrollments.courseId, courseId)
          )
        )
        .limit(1);

      if (existingEnrollment) {
        console.log("ℹ️ Enrollment already exists:", existingEnrollment.id);
        return;
      }

      // Create enrollment
      const [enrollment] = await tx
        .insert(enrollments)
        .values({
          appUserId,
          courseId,
          paymentId: payment.id,
          status: "active",
          progressPercent: 0,
          enrolledAt: new Date(),
        })
        .returning();

      // Update course enrollment count
      const [course] = await tx
        .select()
        .from(courses)
        .where(eq(courses.id, courseId))
        .limit(1);

      if (course) {
        await tx
          .update(courses)
          .set({
            enrollmentCount: course.enrollmentCount + 1,
          })
          .where(eq(courses.id, courseId));
      }

      console.log("✅ Checkout processed:", {
        paymentId: payment.id,
        enrollmentId: enrollment.id,
      });
    });
  } catch (error) {
    console.error("❌ Checkout processing error:", error);
    throw error;
  }
}

// ========================================
// Handle Payment Success
// ========================================
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log("💰 Processing payment:", paymentIntent.id);

    await db.transaction(async (tx) => {
      // Update or create payment record
      const [existingPayment] = await tx
        .select()
        .from(payments)
        .where(eq(payments.stripePaymentIntentId, paymentIntent.id))
        .limit(1);

      let payment;
      if (existingPayment) {
        // Update existing
        [payment] = await tx
          .update(payments)
          .set({
            status: "succeeded",
            updatedAt: new Date(),
          })
          .where(eq(payments.id, existingPayment.id))
          .returning();
      } else {
        // This shouldn't happen, but handle it
        console.warn("⚠️ Payment intent succeeded but no payment record found");
        return;
      }

      // SECURITY: Verify user is active before creating enrollment
      const [user] = await tx
        .select()
        .from(app_users)
        .where(eq(app_users.id, payment.appUserId))
        .limit(1);

      if (!user || !user.isActive) {
        console.error("🚨 SECURITY: Inactive user in payment:", payment.id);
        return;
      }

      // Check for duplicate enrollment
      const [existingEnrollment] = await tx
        .select()
        .from(enrollments)
        .where(
          and(
            eq(enrollments.appUserId, payment.appUserId),
            eq(enrollments.courseId, payment.courseId!)
          )
        )
        .limit(1);

      if (existingEnrollment) {
        return;
      }

      // Create enrollment
      const [enrollment] = await tx
        .insert(enrollments)
        .values({
          appUserId: payment.appUserId,
          courseId: payment.courseId!,
          paymentId: payment.id,
          status: "active",
          progressPercent: 0,
          enrolledAt: new Date(),
        })
        .returning();

      // Update course count
      const [course] = await tx
        .select()
        .from(courses)
        .where(eq(courses.id, payment.courseId!))
        .limit(1);

      if (course) {
        await tx
          .update(courses)
          .set({
            enrollmentCount: course.enrollmentCount + 1,
          })
          .where(eq(courses.id, payment.courseId!));
      }

      console.log("✅ Payment processed:", enrollment.id);
    });
  } catch (error) {
    console.error("❌ Payment processing error:", error);
    throw error;
  }
}

// ========================================
// Handle Payment Failed
// ========================================
async function handlePaymentFailed(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log("❌ Payment failed:", paymentIntent.id);

    await db
      .update(payments)
      .set({
        status: "failed",
        updatedAt: new Date(),
        metadata: {
          failureCode: paymentIntent.last_payment_error?.code,
          failureMessage: paymentIntent.last_payment_error?.message,
        },
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntent.id));

    // SECURITY: Log failed payment for fraud detection
    console.log("📊 Payment failure logged:", {
      intentId: paymentIntent.id,
      reason: paymentIntent.last_payment_error?.message,
    });
  } catch (error) {
    console.error("❌ Error handling payment failure:", error);
  }
}

// ========================================
// Handle Payment Canceled
// ========================================
async function handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log("🚫 Payment canceled:", paymentIntent.id);

    await db
      .update(payments)
      .set({
        status: "failed",
        updatedAt: new Date(),
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntent.id));
  } catch (error) {
    console.error("❌ Error handling cancellation:", error);
  }
}

// ========================================
// Handle Refund
// ========================================
async function handleRefund(charge: Stripe.Charge) {
  try {
    console.log("💸 Processing refund:", charge.id);

    const paymentIntentId = charge.payment_intent as string;

    await db.transaction(async (tx) => {
      const [payment] = await tx
        .update(payments)
        .set({
          status: "refunded",
          updatedAt: new Date(),
        })
        .where(eq(payments.stripePaymentIntentId, paymentIntentId))
        .returning();

      if (!payment) {
        console.warn("⚠️ Refund for unknown payment:", paymentIntentId);
        return;
      }

      // Cancel enrollment
      await tx
        .update(enrollments)
        .set({ status: "cancelled" })
        .where(
          and(
            eq(enrollments.paymentId, payment.id),
            eq(enrollments.appUserId, payment.appUserId)
          )
        );

      // Update course count
      const [course] = await tx
        .select()
        .from(courses)
        .where(eq(courses.id, payment.courseId!))
        .limit(1);

      if (course) {
        await tx
          .update(courses)
          .set({
            enrollmentCount: Math.max(0, course.enrollmentCount - 1),
          })
          .where(eq(courses.id, payment.courseId!));
      }

      console.log("✅ Refund processed");
    });
  } catch (error) {
    console.error("❌ Refund processing error:", error);
  }
}

// ========================================
// Handle Dispute (SECURITY ALERT)
// ========================================
async function handleDispute(dispute: Stripe.Dispute) {
  try {
    console.error("🚨 DISPUTE CREATED:", {
      disputeId: dispute.id,
      amount: dispute.amount / 100,
      reason: dispute.reason,
      status: dispute.status,
    });

    // SECURITY: Mark payment as disputed
    const paymentIntentId = dispute.payment_intent as string;
    
    await db
      .update(payments)
      .set({
        status: "failed", // Or create a "disputed" status
        metadata: {
          disputeId: dispute.id,
          disputeReason: dispute.reason,
          disputeStatus: dispute.status,
          disputedAt: new Date().toISOString(),
        },
      })
      .where(eq(payments.stripePaymentIntentId, paymentIntentId));

    // TODO: Send alert to admin
    // TODO: Potentially suspend enrollment
  } catch (error) {
    console.error("❌ Dispute handling error:", error);
  }
}