// components/AuthForm.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "signup";

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkInbox, setCheckInbox] = useState(false);

  const isSignup = mode === "signup";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (isSignup) {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      setLoading(false);

      if (signUpError) {
        setError(signUpError.message);
        return;
      }

      // With email confirmations on, there's no session yet — tell the user to check email.
      setCheckInbox(true);
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setLoading(false);

    if (signInError) {
      setError(signInError.message);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (checkInbox) {
    return (
      <div className="panel p-6">
        <h2 className="text-lg font-medium">Check your inbox</h2>
        <p className="mt-2 text-sm text-text-muted">
          We sent a confirmation link to {email}. Follow it to activate your account, then come
          back and log in.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="panel space-y-4 p-6">
      {isSignup && (
        <div>
          <label htmlFor="fullName" className="field-label">
            Name
          </label>
          <input
            id="fullName"
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="field-input"
            placeholder="Jordan Lee"
          />
        </div>
      )}

      <div>
        <label htmlFor="email" className="field-label">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="field-input"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="field-label">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="field-input"
          placeholder="At least 6 characters"
        />
      </div>

      {error && (
        <p className="rounded-control border border-signal-red/40 bg-signal-redDim px-3 py-2 text-sm text-signal-red">
          {error}
        </p>
      )}

      <button type="submit" disabled={loading} className="btn-primary w-full">
        {loading ? "Working..." : isSignup ? "Create account" : "Log in"}
      </button>
    </form>
  );
}
