// app/dashboard/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Sidebar from "@/components/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Belt-and-suspenders: middleware.ts already redirects unauthenticated
  // requests, but Server Components should never assume that ran.
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex">
      <Sidebar />
      <div className="min-h-screen flex-1">{children}</div>
    </div>
  );
}
