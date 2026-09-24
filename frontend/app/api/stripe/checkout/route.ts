// app/api/stripe/checkout/route.ts
// Creates a Stripe Checkout Session for the Pro tier and returns its URL.
// The frontend pricing page POSTs here, then redirects the browser to the
// returned url. We never trust a client-supplied price amount — only a
// client-supplied `interval` that we map to a server-side Price ID.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe, STRIPE_PRICE_IDS, type BillingInterval } from "@/lib/stripe/client";

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { interval } = (await request.json()) as { interval: BillingInterval };
  const priceId = STRIPE_PRICE_IDS[interval];

  if (!priceId) {
    return NextResponse.json({ error: "Invalid billing interval" }, { status: 400 });
  }

  // Reuse an existing Stripe customer if this user already has one on file
  // (e.g. a past cancelled subscription), otherwise let Checkout create one.
  const { data: existingSubscription } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: existingSubscription?.stripe_customer_id ?? undefined,
    customer_email: existingSubscription?.stripe_customer_id ? undefined : user.email,
    client_reference_id: user.id,
    // Belt-and-suspenders: client_reference_id AND metadata both carry the
    // user id, since some event types surface one more readily than the other.
    metadata: { user_id: user.id },
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${appUrl}/dashboard?checkout=success`,
    cancel_url: `${appUrl}/pricing?checkout=cancelled`,
  });

  return NextResponse.json({ url: session.url });
}
