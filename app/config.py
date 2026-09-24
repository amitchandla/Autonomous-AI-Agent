"""
config.py
---------
Central place for environment variables and shared client instances.
Every other module imports from here instead of calling os.getenv() directly,
so we only ever configure things in one place.
"""

import os
from pathlib import Path
from dotenv import load_dotenv
from supabase import create_client, Client

# Load .env from project root
load_dotenv()


def _require(key: str) -> str:
    """Fetch a required env var or fail fast with a clear error."""
    value = os.getenv(key)
    if not value:
        raise RuntimeError(
            f"Missing required environment variable: {key}. "
            f"Copy .env.example to .env and fill it in."
        )
    return value


# ---- Supabase ----
SUPABASE_URL = _require("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = _require("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# ---- AI provider ----
AI_PROVIDER = os.getenv("AI_PROVIDER", "mock")  # "mock" | "openai"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

# ---- YouTube OAuth ----
YOUTUBE_CLIENT_ID = os.getenv("YOUTUBE_CLIENT_ID", "")
YOUTUBE_CLIENT_SECRET = os.getenv("YOUTUBE_CLIENT_SECRET", "")
YOUTUBE_REDIRECT_URI = os.getenv("YOUTUBE_REDIRECT_URI", "http://localhost:8000/oauth/youtube/callback")

# ---- App / rendering ----
LOCAL_RENDER_DIR = Path(os.getenv("LOCAL_RENDER_DIR", "./rendered_videos"))
LOCAL_RENDER_DIR.mkdir(parents=True, exist_ok=True)

SCHEDULER_POLL_SECONDS = int(os.getenv("SCHEDULER_POLL_SECONDS", "60"))
