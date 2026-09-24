// app/pricing/page.tsx
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/lib/subscription";
import PricingSection from "@/components/PricingSection";

export default async function PricingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { isPro } = user ? await getSubscriptionStatus(user.id) : { isPro: false };

  return (
    <main className="min-h-screen px-4 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <h1 className="font-display text-3xl">Simple pricing</h1>
        <p className="mt-2 text-text-muted">
          Start free. Upgrade when you want the agent publishing on its own.
        </p>
      </div>

      <div className="mx-auto mt-12 max-w-3xl">
        <PricingSection isAuthenticated={Boolean(user)} isPro={isPro} />
      </div>
    </main>
  );
}
