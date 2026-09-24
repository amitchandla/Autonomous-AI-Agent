// components/Topbar.tsx
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function Topbar({
  title,
  userEmail,
}: {
  title: string;
  userEmail: string | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-border px-6">
      <h1 className="text-sm font-medium text-text-muted">{title}</h1>

      <div className="flex items-center gap-4">
        {userEmail && <span className="text-sm text-text-muted">{userEmail}</span>}
        <button onClick={handleLogout} className="text-sm text-text-muted hover:text-text">
          Log out
        </button>
      </div>
    </header>
  );
}
