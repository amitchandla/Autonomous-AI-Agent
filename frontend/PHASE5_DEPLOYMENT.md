# AutoTube AI — Phase 5: Deployment & 24/7 Cloud Automation

## Architecture decision, up front

There are two ways to keep the automation running in production:

- **A. Always-on process** — the Python backend runs its own APScheduler loop
  forever (`ENABLE_INTERNAL_SCHEDULER=true`), polling Supabase every
  `SCHEDULER_POLL_SECONDS`. Simple, but the process must never sleep, which
  usually means a paid, non-idling hosting tier.
- **B. External cron trigger** (what this phase sets up) — the backend's
  loop is off (`ENABLE_INTERNAL_SCHEDULER=false`). Instead, an outside
  scheduler — **Vercel Cron** or **Supabase Cron** — calls a protected
  endpoint, `POST /cron/run-due-schedules`, on a fixed interval. The
  endpoint does one poll tick and returns.

**This guide uses B.** It decouples "when to check for due schedules" from
"does this process stay alive," which is cheaper and more resilient — if the
backend restarts or briefly goes down, the next cron tick just picks up
where it left off instead of a gap in an in-memory scheduler.

One important limit this decision runs into: **Vercel's free Hobby plan
only allows cron jobs to run once per day**, minimum. If you're on Hobby and
want finer-grained scheduling (hourly, every 15 minutes), use **Supabase
Cron** instead (step 4B below) — it has no such restriction and is free on
every Supabase plan. If you're on Vercel Pro, Vercel Cron supports
every-minute schedules and either option works equally well.

Whichever you pick, use only **one** — running both would double-process
the same due schedules.

---

## 1. Push both projects to GitHub

Each project (`autotube-ai` backend, `autotube-ai-frontend`) should be its
own Git repository — Vercel and Render/Railway/Heroku each connect to a repo
independently.

```bash
cd autotube-ai && git init && git add . && git commit -m "Backend through Phase 5"
# create a repo on GitHub, then:
git remote add origin https://github.com/<you>/autotube-ai.git
git push -u origin main

cd ../autotube-ai-frontend && git init && git add . && git commit -m "Frontend through Phase 5"
git remote add origin https://github.com/<you>/autotube-ai-frontend.git
git push -u origin main
```

Both `.gitignore`-worthy files (`.env`, `.env.local`, `node_modules`,
`rendered_videos/`) should already be excluded — double check before your
first commit that no real secrets are in git history.

## 2. Deploy the backend first (Render, Railway, or Heroku)

The frontend's cron route needs `BACKEND_URL`, so get the backend live
first. A **Dockerfile** is included and required — MoviePy needs `ffmpeg`
and `ImageMagick` installed at the OS level, which none of these platforms'
native Python buildpacks provide.

### Option 1: Render (recommended — simplest Docker + cron-friendly setup)

1. [render.com](https://render.com) → **New → Blueprint** → connect the
   `autotube-ai` GitHub repo. Render reads `render.yaml` automatically and
   proposes a web service using the Dockerfile.
2. **Important:** the blueprint sets `plan: starter` (~$7/mo), not the free
   tier. Render's free web services spin down after 15 minutes of no HTTP
   traffic — since your cron trigger might be hourly or less frequent, a
   spun-down service would miss it (the first request after sleep just
   wakes it up and returns late, or times out entirely depending on your
   cron caller's timeout). Starter or above stays up continuously.
3. Fill in the env vars Render prompts for (everything marked `sync: false`
   in `render.yaml`) — see the full checklist in step 5.
4. Deploy. Once live, note the URL Render gives you, e.g.
   `https://autotube-ai-backend.onrender.com`.
5. Confirm it's healthy: `curl https://autotube-ai-backend.onrender.com/health`
   → `{"status": "ok"}`.

### Option 2: Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub
   repo** → select `autotube-ai`. Railway detects `railway.json` and builds
   from the Dockerfile automatically.
2. **Settings → Variables**: add the same env var checklist (step 5).
3. Railway's free tier sleeps on inactivity same as Render's — pick a paid
   plan if you need the backend reachable at unpredictable cron times.
4. Once deployed, copy the generated domain (Settings → Networking →
   Generate Domain if one isn't assigned yet).

### Option 3: Heroku

1. `heroku create autotube-ai-backend`
2. Heroku needs the `container` stack for Docker builds:
   ```bash
   heroku stack:set container -a autotube-ai-backend
   ```
   (If you'd rather use Heroku's native buildpacks instead of Docker, you'd
   need the `heroku-buildpack-apt` add-on with an `Aptfile` listing `ffmpeg`
   and `imagemagick` — the included `Procfile` supports this path too, but
   Docker is more reliable across platforms and is what this guide assumes.)
3. Set env vars: `heroku config:set KEY=value -a autotube-ai-backend` for
   each one in the step 5 checklist.
4. `git push heroku main`
5. `heroku open -a autotube-ai-backend` (hits `/`, expect a 404 — try
   `/health` instead) or `heroku logs --tail` to watch it boot.

## 3. Deploy the frontend on Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the
   `autotube-ai-frontend` GitHub repo. Vercel auto-detects Next.js — no
   build config changes needed.
2. Before the first deploy, go to **Settings → Environment Variables** and
   add every key from the frontend half of the step 5 checklist. Set them
   for **Production** (and **Preview** too, if you want preview deployments
   to work against a test Stripe/Supabase setup).
3. Deploy. Vercel gives you a domain like `https://autotube-ai.vercel.app`
   (or attach your own custom domain under **Settings → Domains**).
4. **Go back and update three things that depend on knowing this final
   URL** — this is the most commonly missed step in deployments like this:
   - **Google Cloud Console** → your OAuth client's **Authorized redirect
     URIs** → add `https://your-domain.com/api/youtube/callback`.
   - **Backend's `YOUTUBE_REDIRECT_URI`** env var → update to that same
     production callback URL, then redeploy the backend (env var changes
     require a redeploy on all three platforms).
   - **Stripe Dashboard → Developers → Webhooks** → add a production
     endpoint at `https://your-domain.com/api/stripe/webhook` (see Phase
     4's guide for which events to select), then copy its signing secret
     into Vercel's `STRIPE_WEBHOOK_SECRET` — this is a **different** secret
     from the one the Stripe CLI gave you for local testing.

## 4. Wire up the cron trigger

### 4A. Vercel Cron (already configured in `vercel.json`)

```json
{
  "crons": [
    { "path": "/api/cron/trigger", "schedule": "0 * * * *" }
  ]
}
```

This runs hourly (`0 * * * *`). On Vercel, cron jobs deploy automatically
with the project — nothing else to click. To confirm it's registered:
**Project → Settings → Cron Jobs** in the Vercel dashboard.

Add the two secrets this route needs, in **Vercel → Settings → Environment
Variables**:

- `CRON_SECRET` — Vercel automatically sends this as the `Authorization:
  Bearer <value>` header when it invokes your cron route. Generate a random
  value yourself (`openssl rand -hex 32`) and set it here; Vercel picks it
  up for authenticating its own cron calls to you.
- `BACKEND_URL` and `BACKEND_CRON_SECRET` — point at your deployed backend
  and match the `CRON_SECRET` value you set **on the backend** (step 2).
  These authenticate the frontend's call to the backend — a separate
  secret from the one above, on purpose: it's a different hop.

**On Hobby, remember the once-per-day floor** — change the schedule to
something like `0 6 * * *` (6am UTC daily) if you're on Hobby, since `0 * *
* *` (hourly) requires Pro.

Test it manually before waiting for the schedule:
```bash
curl https://your-domain.com/api/cron/trigger \
  -H "Authorization: Bearer <your CRON_SECRET>"
```

### 4B. Supabase Cron (alternative — no plan-tier frequency limit)

If you're staying on Vercel Hobby and want finer-grained scheduling than
once daily, trigger the backend directly from Supabase instead:

1. In the Supabase SQL Editor, enable the two required extensions:
   ```sql
   create extension if not exists pg_cron;
   create extension if not exists pg_net;
   ```
2. Schedule an HTTP call straight to your backend (bypassing the frontend
   entirely — this talks directly to `/cron/run-due-schedules`):
   ```sql
   select cron.schedule(
     'autotube-run-due-schedules',
     '*/15 * * * *',  -- every 15 minutes; adjust as needed
     $$
     select net.http_post(
       url := 'https://your-backend.onrender.com/cron/run-due-schedules',
       headers := jsonb_build_object('x-cron-secret', '<your backend CRON_SECRET>'),
       body := '{}'::jsonb
     );
     $$
   );
   ```
3. Verify it's registered: `select * from cron.job;`
4. If you use this path, **remove or don't deploy** the Vercel Cron config
   (or just don't set `CRON_SECRET` on Vercel) so you're not running both.

## 5. Complete environment variable checklist

### Backend (Render / Railway / Heroku)

| Variable | Where it comes from | Notes |
|---|---|---|
| `SUPABASE_URL` | Supabase → Settings → API | |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Bypasses RLS — server-only, never expose |
| `AI_PROVIDER` | you choose | `openai` in production |
| `OPENAI_API_KEY` | platform.openai.com | Only needed if `AI_PROVIDER=openai` |
| `OPENAI_MODEL` | you choose | e.g. `gpt-4o-mini` |
| `YOUTUBE_CLIENT_ID` | Google Cloud Console | Same OAuth client as the frontend uses |
| `YOUTUBE_CLIENT_SECRET` | Google Cloud Console | |
| `YOUTUBE_REDIRECT_URI` | your production domain | `https://your-domain.com/api/youtube/callback` — must exactly match what's registered in Google Cloud Console and what the frontend's OAuth routes use |
| `LOCAL_RENDER_DIR` | fixed | `./rendered_videos` — ephemeral on most hosts; see note below |
| `ENABLE_INTERNAL_SCHEDULER` | this guide | `false` in production (external cron drives it) |
| `SCHEDULER_POLL_SECONDS` | fixed | Only matters if `ENABLE_INTERNAL_SCHEDULER=true` |
| `CRON_SECRET` | generate: `openssl rand -hex 32` | The frontend's `BACKEND_CRON_SECRET` must match this exactly |
| `PORT` | set automatically | Render/Railway/Heroku inject this — don't set it yourself |

> **Ephemeral filesystem note:** `rendered_videos/` lives on local disk,
> which most of these platforms wipe on every redeploy/restart. That's fine
> for this pipeline specifically — `video_creator.py` renders the file and
> `youtube_uploader.py` uploads it to YouTube in the same request, so
> nothing needs to persist between requests. If you later want to keep
> rendered files around (e.g. for a "download my video" feature), swap
> `LOCAL_RENDER_DIR` for a cloud bucket (S3, Supabase Storage) instead.

### Frontend (Vercel)

| Variable | Where it comes from | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API | Public — safe in the browser |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API | Public — RLS protects the data |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API | Server-only — used by the Stripe webhook |
| `YOUTUBE_CLIENT_ID` | Google Cloud Console | |
| `YOUTUBE_CLIENT_SECRET` | Google Cloud Console | Server-only |
| `YOUTUBE_REDIRECT_URI` | your production domain | Must match the backend's value and Google Cloud Console |
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API keys | Use the **live** key once you switch off test mode |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard → Webhooks → your production endpoint | Different from the Stripe CLI's local secret |
| `STRIPE_PRICE_ID_MONTHLY` | Stripe Dashboard → Products | |
| `STRIPE_PRICE_ID_YEARLY` | Stripe Dashboard → Products | |
| `NEXT_PUBLIC_APP_URL` | your production domain | `https://your-domain.com`, no trailing slash |
| `CRON_SECRET` | generate: `openssl rand -hex 32` | Vercel auto-sends this to your own cron route |
| `BACKEND_URL` | your deployed backend | `https://your-backend.onrender.com`, no trailing slash |
| `BACKEND_CRON_SECRET` | must match backend's `CRON_SECRET` | A different secret from the one above — see step 4A |

## 6. End-to-end production smoke test

1. Visit your live domain, sign up, connect a YouTube channel, subscribe to
   Pro (use a real card in live mode, or stay in Stripe test mode until
   you're confident — test mode works identically end to end).
2. Set an automation with `next_run_at` in the past so it's immediately due
   — easiest way: create it, then in Supabase SQL Editor:
   ```sql
   update automation_schedules set next_run_at = now() - interval '1 minute'
   where user_id = '<your-user-id>';
   ```
3. Manually fire the cron path once rather than waiting for the schedule:
   ```bash
   curl https://your-domain.com/api/cron/trigger \
     -H "Authorization: Bearer <CRON_SECRET>"
   ```
4. Check the response — it should show `schedules_processed: 1` (or more).
   Check Supabase `videos` table for a new row moving through
   `generating_script → rendering → uploading → published`.
5. Check your backend's logs (Render/Railway/Heroku dashboard → Logs) to
   watch the same job execute server-side.
6. Confirm the video landed on the connected YouTube channel as Private.

If all six steps pass, the automation is live end to end, unattended, in
production.

## What's intentionally deferred

- **Multi-region / horizontal scaling** — a single backend instance is
  enough until you have enough users that one process can't keep up with
  render/upload throughput; that's a "add more workers + a job queue"
  problem for well past MVP.
- **Structured logging / alerting** (Sentry, Better Stack, etc.) — the
  current logging is `print`/`logger.info` to stdout, which every platform
  above captures in its own dashboard; wiring up a dedicated error tracker
  is a reasonable next step once you have real users.
- **Custom domain + DNS setup** — covered by each platform's own docs
  (Vercel's domain settings, in particular, are self-explanatory) and
  doesn't have anything AutoTube-specific about it.

---

All five phases are now complete: database, backend agent, frontend
dashboard, billing, and production deployment with unattended scheduling.
