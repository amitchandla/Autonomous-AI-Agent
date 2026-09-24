"""
youtube_uploader.py
--------------------
Handles two things:
  1. Building an authenticated YouTube API client from stored OAuth tokens,
     refreshing the access token when it's expired (and persisting the
     refreshed token back to Supabase).
  2. Uploading a rendered .mp4 file to the connected channel.

NOTE on the OAuth *consent* flow (the part where a user clicks "Connect
YouTube" and grants access): that's a web redirect flow that belongs in
Phase 3 (Frontend + API routes), since it needs browser redirects. This
module assumes a `youtube_connections` row already exists with a valid
refresh_token — i.e., the user has already connected their channel.
"""

from datetime import datetime, timedelta, timezone
from pathlib import Path

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaFileUpload

from app.config import YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET
from app import db

YOUTUBE_UPLOAD_SCOPE = "https://www.googleapis.com/auth/youtube.upload"
TOKEN_URI = "https://oauth2.googleapis.com/token"


def _build_credentials(connection: dict) -> Credentials:
    """Construct google-auth Credentials from a youtube_connections row."""
    return Credentials(
        token=connection["access_token"],
        refresh_token=connection["refresh_token"],
        token_uri=TOKEN_URI,
        client_id=YOUTUBE_CLIENT_ID,
        client_secret=YOUTUBE_CLIENT_SECRET,
        scopes=[YOUTUBE_UPLOAD_SCOPE],
    )


def get_authenticated_client(connection_id: str):
    """
    Fetch the stored connection, refresh the access token if needed,
    persist the refreshed token, and return a ready-to-use YouTube API client.
    """
    connection = db.get_youtube_connection(connection_id)
    if not connection:
        raise ValueError(f"No youtube_connections row found for id={connection_id}")

    creds = _build_credentials(connection)

    # google-auth's Credentials.expired checks the `expiry` field, which we
    # haven't set from our own timestamp — so we check manually against our
    # stored token_expires_at instead.
    expires_at = datetime.fromisoformat(connection["token_expires_at"])
    is_expired = expires_at <= datetime.now(timezone.utc)

    if is_expired or not creds.valid:
        creds.refresh(Request())
        new_expiry = datetime.now(timezone.utc) + timedelta(seconds=3600)
        db.update_youtube_tokens(connection_id, creds.token, new_expiry)

    return build("youtube", "v3", credentials=creds)


def upload_video(
    connection_id: str,
    file_path: Path,
    title: str,
    description: str = "",
    tags: list[str] | None = None,
    privacy_status: str = "private",  # "private" | "unlisted" | "public"
) -> str:
    """
    Upload a rendered video file to the connected YouTube channel.
    Returns the resulting YouTube video ID.

    privacy_status defaults to "private" on purpose — you want a human
    (or a later review step) to flip it public, not an unattended script.
    """
    youtube = get_authenticated_client(connection_id)

    body = {
        "snippet": {
            "title": title[:100],  # YouTube title limit
            "description": description,
            "tags": tags or [],
            "categoryId": "22",  # "People & Blogs" — adjust as needed
        },
        "status": {
            "privacyStatus": privacy_status,
            "selfDeclaredMadeForKids": False,
        },
    }

    media = MediaFileUpload(str(file_path), chunksize=-1, resumable=True, mimetype="video/mp4")

    request = youtube.videos().insert(part="snippet,status", body=body, media_body=media)

    response = None
    while response is None:
        status, response = request.next_chunk()
        if status:
            print(f"Upload progress: {int(status.progress() * 100)}%")

    return response["id"]
