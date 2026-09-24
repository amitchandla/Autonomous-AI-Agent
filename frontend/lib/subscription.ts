// lib/subscription.ts
// The one place that decides "is this user Pro." Both the frontend gating
// (Automation page) and, conceptually, the Python agent's own check
// (Phase 2's db.py) should agree with this definition: an active or
// trialing row in `subscriptions`, not yet past its current_period_end.
import { createClient } from "@/lib/supabase/server";

export async function getSubscriptionStatus(userId: string) {
  const supabase = createClient();

  const { data: subscription } = await supabase
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", userId)
    .maybeSingle();

  const isPro =
    !!subscription &&
    ["active", "trialing"].includes(subscription.status) &&
    (!subscription.current_period_end ||
      new Date(subscription.current_period_end) > new Date());

  return { isPro, subscription };
}
