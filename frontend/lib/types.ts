// lib/types.ts
// Mirrors the Phase 1 Supabase schema. Keep in sync with the SQL.

export type VideoStatus =
  | "pending"
  | "generating_script"
  | "rendering"
  | "uploading"
  | "published"
  | "failed";

export type Video = {
  id: string;
  user_id: string;
  schedule_id: string | null;
  title: string | null;
  script: string | null;
  video_url: string | null;
  youtube_video_id: string | null;
  status: VideoStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
};

export type YoutubeConnection = {
  id: string;
  user_id: string;
  channel_id: string;
  channel_title: string | null;
  connected_at: string;
};

export type Frequency = "daily" | "weekly" | "custom";

export type AutomationSchedule = {
  id: string;
  user_id: string;
  youtube_connection_id: string | null;
  topic_prompt: string;
  frequency: Frequency;
  cron_expression: string | null;
  is_active: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
};
