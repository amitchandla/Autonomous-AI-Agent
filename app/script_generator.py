"""
script_generator.py
--------------------
Turns a topic prompt (from automation_schedules.topic_prompt) into a short
video script: a title + a list of "beats" (short lines meant to be shown
on screen one at a time).

Two providers:
  - "mock"   -> deterministic, free, no API key needed. Great for local testing.
  - "openai" -> real generation via the OpenAI API.

Swap providers via the AI_PROVIDER env var. Both return the exact same
shape, so nothing downstream (video_creator, main) needs to know which
one ran.
"""

import json
import re
from dataclasses import dataclass

from app.config import AI_PROVIDER, OPENAI_API_KEY, OPENAI_MODEL


@dataclass
class VideoScript:
    title: str
    beats: list[str]  # each beat = one line of on-screen text, shown sequentially

    @property
    def full_text(self) -> str:
        return "\n".join(self.beats)


SYSTEM_PROMPT = """You are a scriptwriter for short-form YouTube videos (Shorts/Reels style).
Given a topic, produce a punchy, engaging short-video script.
Respond ONLY with valid JSON in this exact shape, no markdown fences, no commentary:
{
  "title": "a catchy video title, under 70 characters",
  "beats": ["line 1", "line 2", "line 3", "... 5 to 8 short lines total"]
}
Each beat should be a short, spoken-style sentence (under 15 words) suitable for
displaying as a single on-screen caption. Keep the tone energetic and clear."""


def _mock_generate(topic_prompt: str) -> VideoScript:
    """
    Deterministic fake generator so you can test the full pipeline
    (video rendering + YouTube upload) without spending API credits.
    """
    title = f"{topic_prompt.strip().capitalize()} — What You Need to Know"
    beats = [
        f"Let's talk about {topic_prompt.strip()}.",
        "Here's the one thing most people miss.",
        "It's simpler than it looks.",
        "Here's how it actually works.",
        "Try this the next time it comes up.",
        "That's the takeaway — see you in the next one.",
    ]
    return VideoScript(title=title, beats=beats)


def _openai_generate(topic_prompt: str) -> VideoScript:
    from openai import OpenAI

    if not OPENAI_API_KEY:
        raise RuntimeError("AI_PROVIDER is 'openai' but OPENAI_API_KEY is not set.")

    client = OpenAI(api_key=OPENAI_API_KEY)

    completion = client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Topic: {topic_prompt}"},
        ],
        temperature=0.8,
    )

    raw = completion.choices[0].message.content.strip()
    # Defensive cleanup in case the model wraps the JSON in a code fence anyway
    raw = re.sub(r"^```(json)?|```$", "", raw, flags=re.MULTILINE).strip()

    data = json.loads(raw)
    return VideoScript(title=data["title"], beats=data["beats"])


def generate_script(topic_prompt: str) -> VideoScript:
    """Main entry point — dispatches to the configured provider."""
    if AI_PROVIDER == "openai":
        return _openai_generate(topic_prompt)
    return _mock_generate(topic_prompt)
