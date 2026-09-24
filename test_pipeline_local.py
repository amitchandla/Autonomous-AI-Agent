"""
test_pipeline_local.py
-----------------------
Quick sanity-check script that exercises script generation + video
rendering WITHOUT needing Supabase or YouTube credentials set up yet.
Run this first, before wiring up the full FastAPI app, to confirm
MoviePy and your AI provider work on your machine.

Usage:
    python test_pipeline_local.py "3 productivity tips for developers"
"""

import sys

from app.script_generator import generate_script
from app.video_creator import render_video


def main():
    topic = sys.argv[1] if len(sys.argv) > 1 else "the benefits of morning walks"

    print(f"Generating script for topic: {topic!r}")
    script = generate_script(topic)
    print(f"\nTitle: {script.title}")
    print("Beats:")
    for i, beat in enumerate(script.beats, 1):
        print(f"  {i}. {beat}")

    print("\nRendering video (this can take 10-30s depending on your machine)...")
    output_path = render_video(script)
    print(f"\nDone! Video saved to: {output_path.resolve()}")


if __name__ == "__main__":
    main()
