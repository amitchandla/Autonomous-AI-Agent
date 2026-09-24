"""
main.py
-------
FastAPI entry point. Exposes:

  GET  /health                        -> uptime check (also used by hosting
                                          platforms and uptime monitors)
  POST /schedules/{schedule_id}/run   -> manually trigger one schedule now
  POST /cron/run-due-schedules        -> trigger a single poll tick, called
                                          by an EXTERNAL scheduler (Supabase
                                          Cron or Vercel Cron) in production.
                                          Protected by a shared secret header.

Scheduling has two modes, controlled by ENABLE_INTERNAL_SCHEDULER:

  - ENABLE_INTERNAL_SCHEDULER=true (default, good for local dev): an
    in-process APScheduler loop polls Supabase every SCHEDULER_POLL_SECONDS.
    Simple, but requires the process to run 24/7, which costs more on most
    hosts and risks double-processing if you ALSO wire up an external cron.

  - ENABLE_INTERNAL_SCHEDULER=false (recommended for production): the loop
    is disabled, and Supabase Cron or Vercel Cron hits /cron/run-due-schedules
    on a fixed interval instead. This lets the backend run on a cheaper,
    can-idle-between-requests hosting tier since nothing needs to run
    continuously in-process — the trigger comes from outside.
"""

import logging
import os

from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, Header, HTTPException

from app import db
from app.agent import run_schedule
from app.config import SCHEDULER_POLL_SECONDS

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("autotube")

app = FastAPI(title="AutoTube AI - Backend Agent")
scheduler = BackgroundScheduler()

ENABLE_INTERNAL_SCHEDULER = os.getenv("ENABLE_INTERNAL_SCHEDULER", "true").lower() == "true"
CRON_SECRET = os.getenv("CRON_SECRET", "")


def poll_and_run_due_schedules() -> list[dict]:
    """The core tick: find every due schedule and run it. Called by both
    the internal APScheduler loop and the external /cron endpoint, so
    there is exactly one code path for "what happens on a tick" regardless
    of what triggered it."""
    due = db.get_due_schedules()
    if not due:
        logger.info("No due schedules.")
        return []

    logger.info("Found %d due schedule(s).", len(due))
    results = []
    for schedule in due:
        logger.info("Running schedule %s (topic: %s)", schedule["id"], schedule["topic_prompt"])
        result = run_schedule(schedule)
        logger.info("Schedule %s result: %s", schedule["id"], result)
        results.append(result)
    return results


@app.on_event("startup")
def start_scheduler():
    if not ENABLE_INTERNAL_SCHEDULER:
        logger.info(
            "Internal scheduler disabled (ENABLE_INTERNAL_SCHEDULER=false). "
            "Expecting an external cron to call POST /cron/run-due-schedules."
        )
        return

    scheduler.add_job(
        poll_and_run_due_schedules,
        "interval",
        seconds=SCHEDULER_POLL_SECONDS,
        id="poll_due_schedules",
        replace_existing=True,
    )
    scheduler.start()
    logger.info("Internal scheduler started, polling every %ds.", SCHEDULER_POLL_SECONDS)


@app.on_event("shutdown")
def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/schedules/{schedule_id}/run")
def run_schedule_now(schedule_id: str):
    """
    Manually trigger a single schedule immediately, regardless of its
    next_run_at. This is the endpoint you'll hit during local testing.
    """
    response = (
        db.supabase.table("automation_schedules")
        .select("*")
        .eq("id", schedule_id)
        .single()
        .execute()
    )
    schedule = response.data
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")

    result = run_schedule(schedule)
    return {"schedule_id": schedule_id, "result": result}


@app.post("/cron/run-due-schedules")
def cron_run_due_schedules(x_cron_secret: str = Header(default="")):
    """
    Called by an external scheduler (Supabase Cron via pg_net, or a Vercel
    Cron job proxying through a Next.js API route) instead of relying on
    an always-running in-process loop. Protected by a shared secret so
    this can't be triggered by anyone who finds the URL.
    """
    if not CRON_SECRET:
        raise HTTPException(
            status_code=500,
            detail="CRON_SECRET is not configured on the server — refusing to run unprotected.",
        )
    if x_cron_secret != CRON_SECRET:
        raise HTTPException(status_code=401, detail="Invalid or missing x-cron-secret header")

    results = poll_and_run_due_schedules()
    return {"triggered_at": "now", "schedules_processed": len(results), "results": results}
