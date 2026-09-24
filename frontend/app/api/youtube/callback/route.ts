// app/api/youtube/callback/route.ts
// Step 2 of the OAuth flow: Google redirects here with a `code`. We
// exchange it for tokens, fetch the channel's identity, and upsert a
// row into youtube_connections — the exact table youtube_uploader.py
// (Phase 2) reads from.
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true";

export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL!;
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const userId = searchParams.get("state"); // set in /api/youtube/connect
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(
      `${appUrl}/dashboard?youtube_error=${encodeURIComponent(oauthError)}`
    );
  }

  if (!code || !userId) {
    return NextResponse.redirect(`${appUrl}/dashboard?youtube_error=missing_code`);
  }

  // ---- Exchange the authorization code for tokens ----
  const tokenResponse = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.YOUTUBE_CLIENT_ID!,
      client_secret: process.env.YOUTUBE_CLIENT_SECRET!,
      redirect_uri: process.env.YOUTUBE_REDIRECT_URI!,
      grant_type: "authorization_code",
    }),
  });

  if (!tokenResponse.ok) {
    return NextResponse.redirect(`${appUrl}/dashboard?youtube_error=token_exchange_failed`);
  }

  const tokens = await tokenResponse.json();
  const { access_token, refresh_token, expires_in } = tokens;

  if (!refresh_token) {
    // Happens if the user has connected before and Google didn't re-issue
    // a refresh_token. prompt=consent in /connect is what prevents this.
    return NextResponse.redirect(`${appUrl}/dashboard?youtube_error=no_refresh_token`);
  }

  // ---- Fetch the channel identity so we can label the connection ----
  const channelResponse = await fetch(CHANNELS_URL, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  const channelData = await channelResponse.json();
  const channel = channelData.items?.[0];

  if (!channel) {
    return NextResponse.redirect(`${appUrl}/dashboard?youtube_error=no_channel_found`);
  }

  // ---- Persist the connection ----
  const supabase = createClient();
  const tokenExpiresAt = new Date(Date.now() + expires_in * 1000).toISOString();

  const { error: dbError } = await supabase.from("youtube_connections").upsert(
    {
      user_id: userId,
      channel_id: channel.id,
      channel_title: channel.snippet?.title ?? "Untitled channel",
      access_token,
      refresh_token,
      token_expires_at: tokenExpiresAt,
    },
    { onConflict: "user_id,channel_id" }
  );

  if (dbError) {
    return NextResponse.redirect(`${appUrl}/dashboard?youtube_error=save_failed`);
  }

  return NextResponse.redirect(`${appUrl}/dashboard?youtube_connected=1`);
}
