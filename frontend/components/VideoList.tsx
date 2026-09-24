// components/VideoList.tsx
import StatusPill from "@/components/StatusPill";
import type { Video } from "@/lib/types";

export default function VideoList({ videos }: { videos: Video[] }) {
  if (videos.length === 0) {
    return (
      <div className="panel px-5 py-12 text-center">
        <p className="text-sm text-text-muted">No videos yet.</p>
        <p className="mt-1 text-sm text-text-faint">
          Set up an automation and generated videos will show up here as they're made.
        </p>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border text-text-muted">
            <th className="px-5 py-3 font-normal">Title</th>
            <th className="px-5 py-3 font-normal">Status</th>
            <th className="px-5 py-3 font-normal">Created</th>
            <th className="px-5 py-3 font-normal">Link</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {videos.map((video) => (
            <tr key={video.id}>
              <td className="max-w-xs truncate px-5 py-3">{video.title ?? "Untitled"}</td>
              <td className="px-5 py-3">
                <StatusPill status={video.status} />
                {video.status === "failed" && video.error_message && (
                  <p className="mt-1 max-w-xs truncate text-xs text-text-faint">
                    {video.error_message}
                  </p>
                )}
              </td>
              <td className="px-5 py-3 text-text-muted">
                {new Date(video.created_at).toLocaleDateString()}
              </td>
              <td className="px-5 py-3">
                {video.youtube_video_id ? (
                  <a
                    href={`https://youtube.com/watch?v=${video.youtube_video_id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-signal-teal hover:underline"
                  >
                    View on YouTube
                  </a>
                ) : (
                  <span className="text-text-faint">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
