export type ProviderStatus = {
  supabase: boolean;
  supabaseAdmin: boolean;
  anthropic: boolean;
  fal: boolean;
  stripe: boolean;
};

export function getSupabasePublicEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !publishableKey) {
    return null;
  }

  return { url, publishableKey };
}

export function getSupabaseAdminKey() {
  return (
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    null
  );
}

export function getRequiredEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error("Missing environment variable: " + name);
  }

  return value;
}

export function getBaseUrl(requestUrl?: string) {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return "https://" + process.env.VERCEL_PROJECT_PRODUCTION_URL;
  }

  if (requestUrl) {
    return new URL(requestUrl).origin;
  }

  return "http://localhost:3000";
}

export function getProviderStatus(): ProviderStatus {
  const supabase = getSupabasePublicEnv();
  const supabaseAdmin = Boolean(supabase?.url && getSupabaseAdminKey());

  return {
    supabase: Boolean(supabase),
    supabaseAdmin,
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    fal: Boolean(process.env.FAL_KEY),
    stripe: Boolean(process.env.STRIPE_SECRET_KEY),
  };
}
