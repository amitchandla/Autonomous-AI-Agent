// components/UpgradePrompt.tsx
import Link from "next/link";

export default function UpgradePrompt() {
  return (
    <div className="panel border-l-4 border-l-signal-amber p-6">
      <h3 className="font-display text-base">Automation is a Pro feature</h3>
      <p className="mt-2 text-sm text-text-muted">
        The Free tier covers manual video generation. Upgrade to Pro to let the agent write,
        render, and publish videos on a schedule without you triggering each one.
      </p>
      <Link href="/pricing" className="btn-primary mt-4 inline-flex">
        View Pro pricing
      </Link>
    </div>
  );
}
