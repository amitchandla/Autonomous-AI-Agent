// app/api/cron/trigger/route.ts
// Vercel Cron invokes THIS route on the schedule defined in vercel.json.
// It does no heavy work itself (Vercel's function execution limits make it
// the wrong place to render video) — it just verifies the request really
// came from Vercel, then forwards a single POST to the Python backend's
// protected /cron/run-due-schedules endpoint, which does the real work.
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  // Vercel sends Authorization: Bearer $CRON_SECRET automatically for
  // routes registered in vercel.json's "crons" array, once CRON_SECRET is
  // set as an env var on the project. Reject anything else — without this
  // check, anyone who finds this URL could trigger every user's automation
  // early, or hammer it repeatedly.
  const authHeader = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const backendUrl = process.env.BACKEND_URL;
  const backendCronSecret = process.env.BACKEND_CRON_SECRET;

  if (!backendUrl || !backendCronSecret) {
    console.error("BACKEND_URL or BACKEND_CRON_SECRET is not configured.");
    return NextResponse.json({ error: "Backend not configured" }, { status: 500 });
  }

  try {
    const response = await fetch(`${backendUrl}/cron/run-due-schedules`, {
      method: "POST",
      headers: { "x-cron-secret": backendCronSecret },
      // The backend itself returns quickly — it triggers renders/uploads,
      // it doesn't wait for them — so no special timeout handling needed here.
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("Backend cron trigger failed:", data);
      return NextResponse.json({ error: "Backend rejected the trigger", detail: data }, { status: 502 });
    }

    return NextResponse.json({ ok: true, backend: data });
  } catch (err) {
    console.error("Failed to reach backend for cron trigger:", err);
    return NextResponse.json({ error: "Could not reach backend" }, { status: 502 });
  }
}
