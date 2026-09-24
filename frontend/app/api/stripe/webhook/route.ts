// app/api/stripe/webhook/route.ts
// Receives Stripe events and is the SINGLE source of truth for writing
// subscription state into Supabase. Never trust the frontend to report
// "I paid" — only a verified webhook payload updates `subscriptions`/`profiles`.
//
// Next.js App Router route handlers give you the raw, unparsed body by
// default (unlike the old Pages Router, no bodyParser config needed) —
// that raw body is required for Stripe's signature verification.
import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripe } from "@/lib/stripe/client";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      // ---- A checkout just completed: subscription now exists in Stripe ----
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.user_id;

        if (!userId || !session.subscription || !session.customer) break;

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        await upsertSubscription(supabase, userId, subscription);
        break;
      }

      // ---- Renewals, upgrades/downgrades, or Stripe marking it past_due ----
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;
        if (!userId) break;

        await upsertSubscription(supabase, userId, subscription);
        break;
      }

      // ---- Cancellation (immediate or at period end, once it actually ends) ----
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const userId = subscription.metadata?.user_id;
        if (!userId) break;

        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

        await supabase.from("profiles").update({ tier: "free" }).eq("id", userId);
        break;
      }

      // ---- A renewal payment failed — Stripe will retry; reflect the risk state ----
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (!invoice.subscription) break;

        await supabase
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_subscription_id", invoice.subscription as string);
        break;
      }

      default:
        // Unhandled event types are expected — Stripe sends many more than we act on.
        break;
    }
  } catch (err) {
    console.error(`Error handling webhook event ${event.type}:`, err);
    // Return 500 so Stripe retries delivery — a transient DB error shouldn't
    // silently drop a payment confirmation.
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

/**
 * Upserts the subscriptions row and mirrors a simple 'pro'/'free' tier onto
 * profiles, so the rest of the app (and the Python agent) can check one
 * cheap boolean-ish field instead of interpreting Stripe status strings.
 */
async function upsertSubscription(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  subscription: Stripe.Subscription
) {
  const priceId = subscription.items.data[0]?.price.id ?? null;
  const isActive = ["active", "trialing"].includes(subscription.status);

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      status: subscription.status,
      price_id: priceId,
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    },
    { onConflict: "user_id" }
  );

  await supabase
    .from("profiles")
    .update({ tier: isActive ? "pro" : "free" })
    .eq("id", userId);
}
