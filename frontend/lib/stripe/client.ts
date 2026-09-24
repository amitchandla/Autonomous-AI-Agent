// lib/stripe/client.ts
// Single Stripe SDK instance, server-side only. Never import this from a
// Client Component — it uses the secret key.
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2024-06-20",
  typescript: true,
});

// The two Price IDs you create in the Stripe Dashboard for the Pro tier.
export const STRIPE_PRICE_IDS = {
  monthly: process.env.STRIPE_PRICE_ID_MONTHLY!,
  yearly: process.env.STRIPE_PRICE_ID_YEARLY!,
} as const;

export type BillingInterval = keyof typeof STRIPE_PRICE_IDS;
