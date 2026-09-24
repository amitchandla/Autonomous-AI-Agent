// components/ConnectYouTubeButton.tsx
"use client";

import { useState } from "react";

export default function ConnectYouTubeButton() {
  const [loading, setLoading] = useState(false);

  function handleConnect() {
    setLoading(true);
    // Full navigation (not fetch) — this needs to leave the app and land
    // on Google's consent screen, then Google redirects back to our
    // /api/youtube/callback route handler.
    window.location.href = "/api/youtube/connect";
  }

  return (
    <button onClick={handleConnect} disabled={loading} className="btn-primary">
      {loading ? "Redirecting to Google..." : "Connect YouTube channel"}
    </button>
  );
}
