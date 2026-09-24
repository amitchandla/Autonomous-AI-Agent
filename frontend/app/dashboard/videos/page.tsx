// app/dashboard/videos/page.tsx
import { createClient } from "@/lib/supabase/server";
import Topbar from "@/components/Topbar";
import VideoList from "@/components/VideoList";
import type { Video } from "@/lib/types";

export default async function VideosPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: videos } = await supabase
    .from("videos")
    .select("*")
    .eq("user_id", user?.id)
    .order("created_at", { ascending: false })
    .returns<Video[]>();

  return (
    <>
      <Topbar title="Videos" userEmail={user?.email ?? null} />
      <div className="space-y-4 p-6">
        <h2 className="font-display text-lg">All videos</h2>
        <VideoList videos={videos ?? []} />
      </div>
    </>
  );
}
