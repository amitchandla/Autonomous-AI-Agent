// app/dashboard/automation/page.tsx
import { createClient } from "@/lib/supabase/server";
import { getSubscriptionStatus } from "@/lib/subscription";
import Topbar from "@/components/Topbar";
import AutomationForm from "@/components/AutomationForm";
import UpgradePrompt from "@/components/UpgradePrompt";
import type { AutomationSchedule, YoutubeConnection } from "@/lib/types";

export default async function AutomationPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { isPro } = user ? await getSubscriptionStatus(user.id) : { isPro: false };

  const { data: connection } = await supabase
    .from("youtube_connections")
    .select("*")
    .eq("user_id", user?.id)
    .maybeSingle<YoutubeConnection>();

  const { data: schedule } = await supabase
    .from("automation_schedules")
    .select("*")
    .eq("user_id", user?.id)
    .maybeSingle<AutomationSchedule>();

  return (
    <>
      <Topbar title="Automation" userEmail={user?.email ?? null} />

      <div className="max-w-xl space-y-6 p-6">
        <div>
          <h2 className="font-display text-lg">Automation control</h2>
          <p className="mt-1 text-sm text-text-muted">
            Set the niche and schedule — the agent writes, renders, and uploads on its own.
          </p>
        </div>

        {isPro ? (
          <AutomationForm connection={connection} existingSchedule={schedule} />
        ) : (
          <UpgradePrompt />
        )}

        {isPro && schedule?.next_run_at && (
          <p className="text-sm text-text-muted">
            Next run:{" "}
            <span className="text-text">
              {new Date(schedule.next_run_at).toLocaleString()}
            </span>
          </p>
        )}
      </div>
    </>
  );
}
