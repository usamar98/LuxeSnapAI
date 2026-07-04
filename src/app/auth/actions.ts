"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getBaseUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const emailSchema = z.string().email().max(254);

export async function signInWithEmail(formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  let target = "/auth/login?error=invalid-email";

  if (parsed.success) {
    try {
      const requestHeaders = await headers();
      const origin = requestHeaders.get("origin") ?? getBaseUrl();
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: parsed.data,
        options: {
          emailRedirectTo: origin + "/auth/callback",
        },
      });

      if (error) {
        target = "/auth/login?error=" + encodeURIComponent(error.message);
      } else {
        target =
          "/auth/login?sent=1&email=" + encodeURIComponent(parsed.data);
      }
    } catch (error) {
      target =
        "/auth/login?error=" +
        encodeURIComponent(
          error instanceof Error ? error.message : "Unable to start sign in."
        );
    }
  }

  redirect(target);
}
