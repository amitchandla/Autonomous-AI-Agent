// app/(auth)/signup/page.tsx
import Link from "next/link";
import AuthForm from "@/components/AuthForm";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium">Create your account</h1>
          <p className="mt-1 text-sm text-text-muted">
            Connect a channel and let AutoTube AI handle the rest.
          </p>
        </div>

        <AuthForm mode="signup" />

        <p className="mt-6 text-center text-sm text-text-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-signal-teal hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}
