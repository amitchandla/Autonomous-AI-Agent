"""
db.py
-----
All Supabase read/write logic lives here. Nothing else in the app should
call `supabase.table(...)` directly — this keeps queries in one place so
schema changes only need updating here.
"""

from datetime import datetime, timezone
from typing import Optional
from app.config import supabase


# ------------------------------------------------------------------
# SCHEDULES
# ------------------------------------------------------------------

def get_due_schedules() -> list[dict]:
    """
    Fetch all active automation schedules whose next_run_at has passed.
    This is what the scheduler polls on each tick.
    """
    now_iso = datetime.now(timezone.utc).isoformat()
    response = (
        supabase.table("automation_schedules")
        .select("*")
        .eq("is_active", True)
        .lte("next_run_at", now_iso)
        .execute()
    )
    return response.data or []


def mark_schedule_run(schedule_id: str, next_run_at: datetime) -> None:
    """Update last_run_at to now and push next_run_at forward."""
    supabase.table("automation_schedules").update(
        {
            "last_run_at": datetime.now(timezone.utc).isoformat(),
            "next_run_at": next_run_at.isoformat(),
        }
    ).eq("id", schedule_id).execute()


# ------------------------------------------------------------------
# SUBSCRIPTIONS (Pro-tier gating)
# ------------------------------------------------------------------

# Statuses that count as "paying and in good standing." Stripe can report
# other states (past_due, unpaid, canceled) which should NOT unlock the
# automated agent — only the web checkout/portal flow (Phase 4 frontend)
# resolves those back to 'active'.
_ACTIVE_SUBSCRIPTION_STATUSES = {"active", "trialing"}


def is_pro_user(user_id: str) -> bool:
    """
    The single source of truth the automated agent checks before running
    ANY schedule. Mirrors the definition used in the frontend's
    lib/subscription.ts — an active/trialing row that hasn't passed its
    current_period_end. This is what actually gates the agent: a Free
    user's schedule row can still exist (RLS only controls who can write
    a row, not what it's allowed to trigger), so this check is what stops
    it from running.
    """
    response = (
        supabase.table("subscriptions")
        .select("status, current_period_end")
        .eq("user_id", user_id)
        .maybe_single()
        .execute()
    )
    subscription = response.data
    if not subscription:
        return False

    if subscription["status"] not in _ACTIVE_SUBSCRIPTION_STATUSES:
        return False

    period_end = subscription.get("current_period_end")
    if period_end:
        expires_at = datetime.fromisoformat(period_end)
        if expires_at <= datetime.now(timezone.utc):
            return False

    return True


# ------------------------------------------------------------------
# YOUTUBE CONNECTIONS
# ------------------------------------------------------------------

def get_youtube_connection(connection_id: str) -> Optional[dict]:
    response = (
        supabase.table("youtube_connections")
        .select("*")
        .eq("id", connection_id)
        .single()
        .execute()
    )
    return response.data


def update_youtube_tokens(connection_id: str, access_token: str, expires_at: datetime) -> None:
    """Called after a token refresh so we persist the new access token."""
    supabase.table("youtube_connections").update(
        {
            "access_token": access_token,
            "token_expires_at": expires_at.isoformat(),
        }
    ).eq("id", connection_id).execute()


# ------------------------------------------------------------------
# VIDEOS
# ------------------------------------------------------------------

def create_video_record(user_id: str, schedule_id: str, title: str, script: str) -> dict:
    response = (
        supabase.table("videos")
        .insert(
            {
                "user_id": user_id,
                "schedule_id": schedule_id,
                "title": title,
                "script": script,
                "status": "generating_script",
            }
        )
        .execute()
    )
    return response.data[0]


def update_video_status(video_id: str, status: str, **extra_fields) -> None:
    """
    Update a video's status and optionally other fields
    (video_url, youtube_video_id, error_message, etc).
    """
    payload = {"status": status, **extra_fields}
    supabase.table("videos").update(payload).eq("id", video_id).execute()
