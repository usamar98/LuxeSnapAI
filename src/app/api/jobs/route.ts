import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("generation_jobs")
    .select("id,status,scene,style,aspect_ratio,output_url,error,created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    jobs:
      data?.map((job) => ({
        id: job.id,
        status: job.status,
        scene: job.scene,
        style: job.style,
        aspectRatio: job.aspect_ratio,
        outputUrl: job.output_url,
        error: job.error,
        createdAt: job.created_at,
      })) ?? [],
  });
}
