// components/Sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/automation", label: "Automation" },
  { href: "/dashboard/videos", label: "Videos" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 shrink-0 flex-col border-r border-border bg-surface">
      <div className="flex items-center gap-2 px-5 py-5">
        <span className="h-2 w-2 rounded-full bg-signal-teal" aria-hidden />
        <span className="font-display text-base font-medium">AutoTube AI</span>
      </div>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-control px-3 py-2 text-sm transition-colors ${
                isActive
                  ? "bg-surfaceRaised text-text"
                  : "text-text-muted hover:bg-surfaceRaised hover:text-text"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-border px-5 py-4 text-xs text-text-faint">
        Phase 3 dashboard
      </div>
    </aside>
  );
}
