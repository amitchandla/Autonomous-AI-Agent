// lib/supabase/admin.ts
// Service-role Supabase client. Bypasses Row Level Security — use this
// ONLY in trusted server contexts with no user session, like the Stripe
// webhook handler. Never import this into anything a browser can trigger
// without independent verification (e.g. a signed webhook payload).
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
