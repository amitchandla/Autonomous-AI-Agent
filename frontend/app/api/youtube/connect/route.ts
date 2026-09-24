// app/api/youtube/connect/route.ts
// Step 1 of the OAuth flow: build Google's consent URL and redirect the
// user there. We encode the logged-in user's ID in `state` so the
// callback route knows which Supabase user to attach the connection to.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload";
const YOUTUBE_READONLY_SCOPE = "https://www.googleapis.com/auth/youtube.readonly";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", process.env.NEXT_PUBLIC_APP_URL));
  }

  const params = new URLSearchParams({
    client_id: process.env.YOUTUBE_CLIENT_ID!,
    redirect_uri: process.env.YOUTUBE_REDIRECT_URI!,
    response_type: "code",
    access_type: "offline", // required to get a refresh_token back
    prompt: "consent", // forces refresh_token on every connect, not just the first
    scope: [YOUTUBE_UPLOAD_SCOPE, YOUTUBE_READONLY_SCOPE].join(" "),
    state: user.id,
  });

  return NextResponse.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
