"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

export function createClient() {
  const env = getSupabasePublicEnv();

  if (!env) {
    throw new Error("Supabase is not configured.");
  }

  return createBrowserClient<Database>(env.url, env.publishableKey);
}
