# AutoTube AI — Phase 2: Backend & AI Video Agent

## Project structure

```
autotube-ai/
├── app/
│   ├── __init__.py
│   ├── config.py            # env vars + Supabase client
│   ├── db.py                 # all Supabase queries
│   ├── script_generator.py   # AI script generation (mock or OpenAI)
│   ├── video_creator.py      # MoviePy video rendering
│   ├── youtube_uploader.py   # YouTube Data API v3 upload + token refresh
│   ├── agent.py               # orchestrates the full pipeline
│   └── main.py                # FastAPI app + background scheduler
├── test_pipeline_local.py    # test script gen + rendering with zero setup
├── requirements.txt
└── .env.example
```

## 1. System dependencies

MoviePy needs **ImageMagick** and **ffmpeg** installed on your system (not via pip).

**macOS:**
```bash
brew install imagemagick ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install imagemagick ffmpeg
```

**Windows:** install both from their official sites and make sure they're on your PATH.

> If TextClip rendering fails with a "policy.xml" / permission error, ImageMagick's default
> security policy blocks text rendering. Edit `/etc/ImageMagick-6/policy.xml` (path varies) and
> comment out the line that restricts `@*` / `MVG`/`TEXT` — this is a very common ImageMagick gotcha,
> not a bug in this code.

## 2. Python setup

```bash
cd autotube-ai
python3 -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

## 3. Fill in `.env`

At minimum, for local testing:

- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard → Settings → API.
  **Use the service_role key here, not the anon key** — this backend needs to bypass RLS
  to act on behalf of all users' scheduled jobs.
- Leave `AI_PROVIDER=mock` for now — free, deterministic, no API key needed.
- YouTube credentials come later in step 5 below.

## 4. Test the AI + video rendering pipeline in isolation

This is the fastest way to confirm your environment works, with **no Supabase or YouTube
setup required yet**:

```bash
python test_pipeline_local.py "3 productivity tips for developers"
```

You should see script output printed to the console, then a `.mp4` file appear in
`./rendered_videos/`. Open it and confirm the text overlays display correctly.

## 5. Set up YouTube OAuth credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → create a project (or use an existing one).
2. Enable the **YouTube Data API v3** (APIs & Services → Library).
3. Go to **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:8000/oauth/youtube/callback`
4. Copy the generated Client ID and Client Secret into `.env` as `YOUTUBE_CLIENT_ID` / `YOUTUBE_CLIENT_SECRET`.
5. Under **OAuth consent screen**, add your own Google account as a **test user** (required
   while the app is in "Testing" publishing status).

> **Important:** the actual browser consent flow (user clicks "Connect YouTube," gets redirected
> to Google, grants access, gets redirected back) is a Phase 3 concern — it needs frontend
> routes. For Phase 2 testing, you'll manually create one `youtube_connections` row so the
> upload logic has something to work with (next step).

## 6. Manually seed a test schedule + connection

Since the OAuth consent UI doesn't exist yet, run this in the Supabase SQL Editor to create
test data (replace the placeholder values):

```sql
-- 1. Use an existing user's UUID from auth.users, or sign up a test user first.
-- 2. You'll need a real refresh_token for youtube_connections — the easiest way to get one
--    locally is Google's OAuth 2.0 Playground (https://developers.google.com/oauthplayground):
--    set your own Client ID/Secret in its settings, authorize scope
--    https://www.googleapis.com/auth/youtube.upload, and exchange for tokens.

insert into youtube_connections (user_id, channel_id, channel_title, access_token, refresh_token, token_expires_at)
values (
  '<your-test-user-uuid>',
  'UC_test_channel_id',
  'My Test Channel',
  'placeholder-will-be-refreshed-automatically',
  '<real-refresh-token-from-oauth-playground>',
  now() - interval '1 hour'  -- force it to look expired so the code exercises the refresh path
);

insert into automation_schedules (user_id, youtube_connection_id, topic_prompt, frequency, is_active, next_run_at)
values (
  '<your-test-user-uuid>',
  (select id from youtube_connections where channel_id = 'UC_test_channel_id'),
  'daily productivity tips',
  'daily',
  true,
  now() - interval '1 minute'  -- already "due" so it runs immediately
);
```

## 7. Run the backend

```bash
uvicorn app.main:app --reload --port 8000
```

- Visit `http://localhost:8000/health` → should return `{"status": "ok"}`.
- The background scheduler will automatically pick up the due schedule within
  `SCHEDULER_POLL_SECONDS` (default 60s) and run the full pipeline.
- Or trigger it immediately without waiting:

```bash
curl -X POST http://localhost:8000/schedules/<schedule-id>/run
```

Watch the terminal logs — you'll see script generation, rendering progress, and upload
progress percentages. Check the `videos` table in Supabase to watch `status` move through
`generating_script` → `rendering` → `uploading` → `published` (or `failed` with an
`error_message` if something broke).

The uploaded video will appear on the connected YouTube channel as **Private** (intentional —
see `youtube_uploader.py` comments) so you can review it before it ever goes public.

## 8. Switch to real AI generation (optional, once mock works)

In `.env`:
```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
```
Re-run `test_pipeline_local.py` to confirm real generated scripts render correctly.

## What's intentionally deferred to later phases

- **YouTube OAuth consent web flow** (the actual "Connect YouTube" button) → Phase 3, needs frontend routes.
- **Stripe-gated access** (e.g. free tier limited to 1 video/week) → Phase 3/4.
- **Token encryption at rest** for `youtube_connections` → flagged in Phase 1, addressed before production.
- **Voiceover / TTS audio + background music** → video_creator.py currently renders silent video only.
- **Real cron parsing for "custom" frequency** → currently only "daily"/"weekly" are implemented.

---

Once you've run a test schedule end-to-end and confirmed a video lands on your YouTube
channel (as Private), let me know and we'll move to **Phase 3: Frontend + API Routes**
(Next.js UI, the real YouTube OAuth consent flow, Stripe checkout, and dashboard).
