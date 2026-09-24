// components/PricingSection.tsx
"use client";

import { useState } from "react";
import PricingCard from "@/components/PricingCard";
import type { BillingInterval } from "@/lib/stripe/client";

export default function PricingSection({
  isAuthenticated,
  isPro,
}: {
  isAuthenticated: boolean;
  isPro: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  const proPrice = interval === "monthly" ? "$29" : "$290";
  const proCadence = interval === "monthly" ? "/month" : "/year";

  return (
    <div>
      <div className="mb-8 flex justify-center">
        <div className="inline-flex rounded-control border border-border bg-surface p-1">
          {(["monthly", "yearly"] as const).map((option) => (
            <button
              key={option}
              onClick={() => setInterval(option)}
              className={`rounded-control px-4 py-1.5 text-sm capitalize transition-colors ${
                interval === option ? "bg-surfaceRaised text-text" : "text-text-muted"
              }`}
            >
              {option}
              {option === "yearly" && (
                <span className="ml-1.5 text-signal-teal">save 17%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <PricingCard
          tier={{
            name: "Free",
            price: "$0",
            cadence: "/forever",
            description: "Try the pipeline before automating it.",
            features: [
              "Manual video generation",
              "1 connected YouTube channel",
              "Standard rendering queue",
            ],
            isPro: false,
          }}
          interval={interval}
          isCurrentPlan={isAuthenticated && !isPro}
          isAuthenticated={isAuthenticated}
        />

        <PricingCard
          tier={{
            name: "Pro",
            price: proPrice,
            cadence: proCadence,
            description: "Let the agent run on a schedule, hands-off.",
            features: [
              "Automated daily or weekly publishing",
              "Unlimited generated videos",
              "Priority rendering queue",
              "Email support",
            ],
            isPro: true,
          }}
          interval={interval}
          isCurrentPlan={isAuthenticated && isPro}
          isAuthenticated={isAuthenticated}
        />
      </div>
    </div>
  );
}
