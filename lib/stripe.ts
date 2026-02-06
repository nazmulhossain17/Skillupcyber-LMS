// lib/stripe.ts
import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
}

// Initialize Stripe with singleton pattern
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-11-17.clover",
  typescript: true,
});

// Webhook secret
export const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";

// Helper function to format amount for Stripe (convert dollars to cents)
export function formatAmountForStripe(amount: number): number {
  return Math.round(amount * 100);
}

// Helper function to format amount from Stripe (convert cents to dollars)
export function formatAmountFromStripe(amount: number): number {
  return amount / 100;
}