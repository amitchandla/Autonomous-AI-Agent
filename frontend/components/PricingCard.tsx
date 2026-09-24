// components/PricingCard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { BillingInterval } from "@/lib/stripe/client";

type Tier = {
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  isPro: boolean;
};

export default function PricingCard({
  tier,
  interval,
  isCurrentPlan,
  isAuthenticated,
}: {
  tier: Tier;
  interval: BillingInterval;
  isCurrentPlan: boolean;
  isAuthenticated: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUpgrade() {
    if (!isAuthenticated) {
      router.push("/signup");
      return;
    }

    setLoading(true);
    setError(null);

    const response = await fetch("/api/stripe/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interval }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Something went wrong starting checkout.");
      setLoading(false);
      return;
    }

    window.location.href = data.url;
  }

  return (
    <div
      className={`panel flex flex-col p-6 ${
        tier.isPro ? "border-signal-teal/50" : ""
      }`}
    >
      <h3 className="font-display text-lg">{tier.name}</h3>
      <p className="mt-1 text-sm text-text-muted">{tier.description}</p>

      <div className="mt-5 flex items-baseline gap-1">
        <span className="font-display text-3xl">{tier.price}</span>
        <span className="text-sm text-text-muted">{tier.cadence}</span>
      </div>

      <ul className="mt-6 flex-1 space-y-2.5 text-sm text-text-muted">
        {tier.features.map((feature) => (
          <li key={feature} className="flex items-start gap-2">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-faint" aria-hidden />
            {feature}
          </li>
        ))}
      </ul>

      {error && (
        <p className="mt-4 rounded-control border border-signal-red/40 bg-signal-redDim px-3 py-2 text-sm text-signal-red">
          {error}
        </p>
      )}

      <div className="mt-6">
        {isCurrentPlan ? (
          <span className="btn-secondary w-full cursor-default">Current plan</span>
        ) : tier.isPro ? (
          <button onClick={handleUpgrade} disabled={loading} className="btn-primary w-full">
            {loading ? "Redirecting..." : "Upgrade to Pro"}
          </button>
        ) : (
          <span className="btn-secondary w-full cursor-default opacity-70">
            {isAuthenticated ? "Included" : "Free to start"}
          </span>
        )}
      </div>
    </div>
  );
}
