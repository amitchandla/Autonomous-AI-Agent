"""
video_creator.py
-----------------
Renders a VideoScript into an actual .mp4 file using MoviePy.

For Phase 2 we keep this deliberately simple: a solid-color vertical
background (1080x1920, YouTube Shorts format) with each script "beat"
displayed as centered white text for a few seconds, in sequence.

This is intentionally the easiest part to swap out later — e.g. you
could replace the background with stock footage, add a TTS voiceover
track, add background music, etc. The function signature
(VideoScript -> file path) is the contract the rest of the app relies on.
"""

import uuid
from pathlib import Path

from moviepy.editor import (
    ColorClip,
    TextClip,
    CompositeVideoClip,
    concatenate_videoclips,
)

from app.config import LOCAL_RENDER_DIR
from app.script_generator import VideoScript

# Shorts-friendly vertical resolution
VIDEO_WIDTH = 1080
VIDEO_HEIGHT = 1920
SECONDS_PER_BEAT = 3
BACKGROUND_COLOR = (18, 18, 18)  # near-black


def _make_beat_clip(text: str, duration: float) -> CompositeVideoClip:
    background = ColorClip(size=(VIDEO_WIDTH, VIDEO_HEIGHT), color=BACKGROUND_COLOR).set_duration(duration)

    text_clip = (
        TextClip(
            text,
            fontsize=64,
            color="white",
            font="DejaVu-Sans-Bold",  # ships with most Linux/ImageMagick installs
            size=(VIDEO_WIDTH - 160, None),
            method="caption",
            align="center",
        )
        .set_duration(duration)
        .set_position("center")
    )

    return CompositeVideoClip([background, text_clip])


def render_video(script: VideoScript, output_filename: str | None = None) -> Path:
    """
    Render a VideoScript to an .mp4 file on disk and return its path.
    Raises on failure — callers should catch and mark the video record 'failed'.
    """
    if not script.beats:
        raise ValueError("Script has no beats to render.")

    clips = [_make_beat_clip(beat, SECONDS_PER_BEAT) for beat in script.beats]
    final = concatenate_videoclips(clips, method="compose")

    output_filename = output_filename or f"{uuid.uuid4()}.mp4"
    output_path = LOCAL_RENDER_DIR / output_filename

    final.write_videofile(
        str(output_path),
        fps=30,
        codec="libx264",
        audio=False,  # no audio track yet — add TTS/music in a later phase
        preset="medium",
        threads=4,
        logger=None,  # silence MoviePy's verbose bar; remove this to debug rendering
    )

    for clip in clips:
        clip.close()
    final.close()

    return output_path
