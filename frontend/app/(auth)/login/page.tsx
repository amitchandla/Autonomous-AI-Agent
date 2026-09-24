// app/(auth)/login/page.tsx
import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium">Log in to AutoTube AI</h1>
          <p className="mt-1 text-sm text-text-muted">
            Pick up your automations where you left off.
          </p>
        </div>

        <AuthForm mode="login" />

        <p className="mt-6 text-center text-sm text-text-muted">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-signal-teal hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}
