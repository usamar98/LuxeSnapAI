import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseAdminKey, getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

let adminClient: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin() {
  const env = getSupabasePublicEnv();
  const secretKey = getSupabaseAdminKey();

  if (!env || !secretKey) {
    throw new Error("Supabase admin credentials are not configured.");
  }

  if (!adminClient) {
    adminClient = createClient<Database>(env.url, secretKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
