// components/AutomationForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { AutomationSchedule, Frequency, YoutubeConnection } from "@/lib/types";

function nextRunFromTime(frequency: Frequency, time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  const next = new Date();
  next.setHours(hours, minutes, 0, 0);
  if (next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 1);
  }
  if (frequency === "weekly" && next.getTime() <= Date.now()) {
    next.setDate(next.getDate() + 7);
  }
  return next.toISOString();
}

export default function AutomationForm({
  connection,
  existingSchedule,
}: {
  connection: YoutubeConnection | null;
  existingSchedule: AutomationSchedule | null;
}) {
  const router = useRouter();
  const supabase = createClient();

  const [topicPrompt, setTopicPrompt] = useState(existingSchedule?.topic_prompt ?? "");
  const [frequency, setFrequency] = useState<Frequency>(existingSchedule?.frequency ?? "daily");
  const [time, setTime] = useState("09:00");
  const [isActive, setIsActive] = useState(existingSchedule?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!connection) return;

    setSaving(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload = {
      user_id: user?.id,
      youtube_connection_id: connection.id,
      topic_prompt: topicPrompt,
      frequency,
      is_active: isActive,
      next_run_at: nextRunFromTime(frequency, time),
    };

    const { error: upsertError } = existingSchedule
      ? await supabase.from("automation_schedules").update(payload).eq("id", existingSchedule.id)
      : await supabase.from("automation_schedules").insert(payload);

    setSaving(false);

    if (upsertError) {
      setError(upsertError.message);
      return;
    }

    router.refresh();
  }

  if (!connection) {
    return (
      <div className="panel p-6 text-sm text-text-muted">
        Connect a YouTube channel from the Overview page before setting up an automation.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel space-y-5 p-6">
      <div>
        <label htmlFor="topicPrompt" className="field-label">
          Channel niche
        </label>
        <textarea
          id="topicPrompt"
          required
          rows={3}
          value={topicPrompt}
          onChange={(e) => setTopicPrompt(e.target.value)}
          className="field-input resize-none"
          placeholder="e.g. quick productivity tips for software developers"
        />
        <p className="mt-1.5 text-xs text-text-faint">
          This drives every script the agent writes. Be specific — it produces better videos.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="frequency" className="field-label">
            Frequency
          </label>
          <select
            id="frequency"
            value={frequency}
            onChange={(e) => setFrequency(e.target.value as Frequency)}
            className="field-input"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
        </div>

        <div>
          <label htmlFor="time" className="field-label">
            Publish time
          </label>
          <input
            id="time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="field-input"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-text-muted">
        <input
          type="checkbox"
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
          className="h-4 w-4 rounded border-border bg-base accent-signal-teal"
        />
        Automation is active
      </label>

      {error && (
        <p className="rounded-control border border-signal-red/40 bg-signal-redDim px-3 py-2 text-sm text-signal-red">
          {error}
        </p>
      )}

      <button type="submit" disabled={saving} className="btn-primary">
        {saving ? "Saving..." : existingSchedule ? "Save changes" : "Start automation"}
      </button>
    </form>
  );
}
