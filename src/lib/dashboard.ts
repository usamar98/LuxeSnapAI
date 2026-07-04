import { getProviderStatus } from "@/lib/env";
import type { DashboardJob, InitialDashboardState } from "@/lib/app-types";
import { createClient } from "@/lib/supabase/server";

const demoJobs: DashboardJob[] = [
  {
    id: "demo-jet",
    status: "completed",
    scene: "private-jet",
    style: "editorial",
    aspectRatio: "1:1",
    outputUrl: null,
    error: null,
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-yacht",
    status: "generating",
    scene: "yacht",
    style: "cinematic",
    aspectRatio: "9:16",
    outputUrl: null,
    error: null,
    createdAt: new Date(Date.now() - 1000 * 60 * 18).toISOString(),
  },
];

export async function getDashboardState(): Promise<InitialDashboardState> {
  const providers = getProviderStatus();

  if (!providers.supabase) {
    return {
      providers,
      user: null,
      jobs: demoJobs,
      demo: true,
    };
  }

  try {
    const supabase = await createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;

    if (!userId) {
      return {
        providers,
        user: null,
        jobs: demoJobs,
        demo: false,
      };
    }

    const [{ data: profile }, { data: userData }, { data: jobs }] =
      await Promise.all([
        supabase
          .from("profiles")
          .select("id,email,credits")
          .eq("id", userId)
          .maybeSingle(),
        supabase.auth.getUser(),
        supabase
          .from("generation_jobs")
          .select("id,status,scene,style,aspect_ratio,output_url,error,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);

    return {
      providers,
      user: {
        id: userId,
        email: profile?.email ?? userData.user?.email ?? null,
        credits: profile?.credits ?? 0,
      },
      jobs:
        jobs?.map((job) => ({
          id: job.id,
          status: job.status,
          scene: job.scene,
          style: job.style,
          aspectRatio: job.aspect_ratio,
          outputUrl: job.output_url,
          error: job.error,
          createdAt: job.created_at,
        })) ?? [],
      demo: false,
    };
  } catch {
    return {
      providers,
      user: null,
      jobs: demoJobs,
      demo: true,
    };
  }
}
