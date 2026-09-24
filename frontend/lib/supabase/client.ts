// lib/supabase/client.ts
// Supabase client for use in Client Components (browser).
"use client";

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.https://xmakfkrsldsaysrcaiaa.supabase.co,
    process.sb_publishable_g4dHf6qeijl8jyQ6uddBwA_Wemws0dg!
  );
}
