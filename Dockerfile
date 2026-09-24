# Dockerfile
# Production image for the AutoTube AI backend. A Dockerfile (rather than a
# platform's native Python buildpack) is used deliberately: MoviePy needs
# ffmpeg and ImageMagick installed at the OS level, which buildpacks on
# Render/Railway/Heroku don't include by default. This works identically
# across all three hosts.

FROM python:3.11-slim

# ---- System dependencies ----
# ffmpeg: video encoding (MoviePy's write_videofile backend)
# imagemagick: text rendering (MoviePy's TextClip)
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    imagemagick \
    && rm -rf /var/lib/apt/lists/*

# ImageMagick's default policy blocks text/label operations (the same
# "policy.xml" gotcha noted in the Phase 2 README) — loosen it so
# TextClip works unattended in this container.
RUN sed -i 's/rights="none" pattern="@\*"/rights="read|write" pattern="@*"/' \
    /etc/ImageMagick-6/policy.xml || true
RUN sed -i 's/rights="none" pattern="TEXT"/rights="read|write" pattern="TEXT"/' \
    /etc/ImageMagick-6/policy.xml || true

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Render/Railway/Heroku all inject $PORT at runtime — bind to it, not a
# hardcoded port, or the platform's health check will never see the app come up.
ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
