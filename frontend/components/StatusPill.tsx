// components/StatusPill.tsx
import type { VideoStatus } from "@/lib/types";

const STATUS_CONFIG: Record<VideoStatus, { label: string; dot: string; text: string }> = {
  pending: { label: "Queued", dot: "bg-text-faint", text: "text-text-muted" },
  generating_script: { label: "Writing script", dot: "bg-signal-amber", text: "text-signal-amber" },
  rendering: { label: "Rendering", dot: "bg-signal-amber", text: "text-signal-amber" },
  uploading: { label: "Uploading", dot: "bg-signal-amber", text: "text-signal-amber" },
  published: { label: "Published", dot: "bg-signal-teal", text: "text-signal-teal" },
  failed: { label: "Failed", dot: "bg-signal-red", text: "text-signal-red" },
};

export default function StatusPill({ status }: { status: VideoStatus }) {
  const config = STATUS_CONFIG[status];
  const isActive = ["generating_script", "rendering", "uploading"].includes(status);

  return (
    <span className={`inline-flex items-center gap-1.5 text-sm ${config.text}`}>
      <span
        className={`h-1.5 w-1.5 rounded-full ${config.dot} ${isActive ? "animate-pulse" : ""}`}
        aria-hidden
      />
      {config.label}
    </span>
  );
}
