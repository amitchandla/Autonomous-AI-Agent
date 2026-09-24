# AutoTube AI — Phase 3: Frontend Dashboard

## Project structure

```
autotube-ai-frontend/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   ├── dashboard/
│   │   ├── layout.tsx          # sidebar shell + server-side auth guard
│   │   ├── page.tsx             # overview: connection banner + recent videos
│   │   ├── automation/page.tsx  # niche/frequency/timing control panel
│   │   └── videos/page.tsx      # full video list
│   ├── api/youtube/
│   │   ├── connect/route.ts     # step 1: redirect to Google consent
│   │   └── callback/route.ts    # step 2: exchange code, save connection
│   ├── layout.tsx                # root layout, fonts
│   ├── page.tsx                  # redirects to /dashboard or /login
│   └── globals.css               # design tokens (see Phase 3 notes below)
├── components/
│   ├── AuthForm.tsx
│   ├── Sidebar.tsx
│   ├── Topbar.tsx
│   ├── ConnectYouTubeButton.tsx
│   ├── AutomationForm.tsx
│   ├── VideoList.tsx
│   └── StatusPill.tsx
├── lib/
│   ├── supabase/client.ts        # browser client
│   ├── supabase/server.ts        # server client (Server Components/Routes)
│   └── types.ts                   # mirrors the Phase 1 SQL schema
├── middleware.ts                  # refreshes auth session, guards /dashboard
├── tailwind.config.ts
└── .env.local.example
```

## 1. Install

```bash
cd autotube-ai-frontend
npm install
cp .env.local.example .env.local
```

## 2. Fill in `.env.local`

- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase dashboard → Settings → API.
  Use the **anon** key here (not service_role) — this is browser-exposed code, and Row Level
  Security (from Phase 1) is what keeps it safe.
- `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET` — same Google Cloud OAuth client from Phase 2.
- Add a **second** authorized redirect URI to that same OAuth client in Google Cloud Console:
  `http://localhost:3000/api/youtube/callback` (the Phase 2 README used port 8000 for the
  backend's own testing flow — this is the real one the frontend uses).

## 3. Enable email auth in Supabase

Supabase → Authentication → Providers → Email should already be on by default. For local
testing without setting up SMTP, go to Authentication → Settings and you can temporarily
disable "Confirm email" so signup logs you in immediately — just remember to re-enable it
before going to production.

## 4. Run it

```bash
npm run dev
```

Visit `http://localhost:3000`:

1. **Sign up** — creates a Supabase auth user (the Phase 1 trigger auto-creates their `profiles` row).
2. **Log in** — lands on `/dashboard`, which shows "No channel connected."
3. **Connect YouTube channel** — click the button, complete Google's consent screen, land back
   on the dashboard with a connected-channel banner. This writes a row into
   `youtube_connections` — the exact table Phase 2's `youtube_uploader.py` reads from, so the
   backend agent can now use whatever channel you just connected.
4. **Automation tab** — type a niche, pick frequency and time, save. This writes to
   `automation_schedules`, which Phase 2's scheduler polls.
5. **Videos tab** — once the Phase 2 backend runs a scheduled (or manually triggered) job,
   refresh this page and the video's status will show, updating from queued through published.

## Design notes

The dashboard intentionally avoids the generic dark-SaaS look (uniform rounded cards, single
acid accent, gradient hero). Two functional accent colors do double duty as both brand color
and status color: teal signals "connected / published," amber signals "in progress." The
channel-connection banner is a full-width strip with a left accent bar rather than a centered
card, and the video list is a plain divided table rather than a card grid — both read faster
for data you're scanning repeatedly, which is most of what a dashboard is for.

## What's intentionally deferred to later phases

- **Stripe billing UI** (upgrade button, tier gating on the automation form) → Phase 4.
- **Settings page** (rename channel, disconnect, delete account) → not in this phase's scope.
- **Real-time video status updates** (Supabase Realtime subscription instead of manual refresh)
  — the videos/overview pages currently fetch on page load; swapping in a `useEffect` +
  `supabase.channel(...)` subscription is a natural upgrade once Phase 4 is in.
- **Multiple channels per user** — the schema and queries here assume one `youtube_connections`
  row per user (`.maybeSingle()`); Phase 1's schema already supports more than one if you want
  to extend the UI for it later.

---

Once you've confirmed you can sign up, connect a channel, save an automation, and see a video's
status change from Phase 2's backend, let me know and we'll move to **Phase 4: Stripe
Subscriptions & Billing** (Free vs. Pro tier gating, checkout, and the customer portal).
