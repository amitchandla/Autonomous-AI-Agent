// app/dashboard/page.tsx
import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/Topbar";
import ConnectYouTubeButton from "@/components/ConnectYouTubeButton";
import StatusPill from "@/components/StatusPill";
import type { Video, YoutubeConnection } from "@/lib/types";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: { youtube_connected?: string; youtube_error?: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: connection } = await supabase
    .from("youtube_connections")
    .select("*")
    .eq("user_id", user?.id)
    .maybeSingle<YoutubeConnection>();

  const { data: recentVideos } = await supabase
    .from("videos")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false })
    .limit(5)
    .returns<Video[]>();

  const isConnected = Boolean(connection);

  return (
    <>
      <Topbar title="Overview" userEmail={user?.email ?? null} />

      <div className="space-y-6 p-6">
        {searchParams.youtube_error && (
          <div className="rounded-control border border-signal-red/40 bg-signal-redDim px-4 py-3 text-sm text-signal-red">
            Couldn&apos;t connect your channel ({searchParams.youtube_error}). Try again.
          </div>
        )}
        {searchParams.youtube_connected && (
          <div className="rounded-control border border-signal-teal/40 bg-signal-tealDim px-4 py-3 text-sm text-signal-teal">
            Channel connected. Set up an automation to start publishing.
          </div>
        )}

        {/* Connection status banner — full-width, left accent bar, not a centered card */}
        <div
          className={`flex items-center justify-between rounded-panel border-l-4 bg-surface p-5 ${
            isConnected ? "border-l-signal-teal" : "border-l-signal-amber"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  isConnected ? "bg-signal-teal" : "bg-signal-amber"
                }`}
                aria-hidden
              />
              <h2 className="font-display text-lg">
                {isConnected ? connection!.channel_title : "No channel connected"}
              </h2>
            </div>
            <p className="mt-1 text-sm text-text-muted">
              {isConnected
                ? "AutoTube AI can publish videos to this channel."
                : "Connect a channel so automations have somewhere to publish."}
            </p>
          </div>

          {!isConnected && <ConnectYouTubeButton />}
        </div>

        {/* Recent activity */}
        <div className="panel">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h2 className="font-display text-base">Recent videos</h2>
            <a href="/dashboard/videos" className="text-sm text-signal-teal hover:underline">
              View all
            </a>
          </div>

          {recentVideos && recentVideos.length > 0 ? (
            <ul className="divide-y divide-border">
              {recentVideos.map((video) => (
                <li key={video.id} className="flex items-center justify-between px-5 py-3">
                  <span className="truncate text-sm">{video.title ?? "Untitled"}</span>
                  <StatusPill status={video.status} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-5 py-8 text-center text-sm text-text-muted">
              No videos yet. Set up an automation and your first one will appear here.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
