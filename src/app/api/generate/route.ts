import { NextResponse } from "next/server";
import { z } from "zod";

import { analyzeSelfie } from "@/lib/anthropic";
import { getProviderStatus } from "@/lib/env";
import { FAL_IMAGE_COST_CENTS } from "@/lib/plans";
import { generateKontextImage } from "@/lib/fal";
import {
  MAX_SELFIE_SIZE_BYTES,
  buildLuxuryPrompt,
  extensionForMimeType,
  isSupportedMimeType,
} from "@/lib/generation";
import {
  aspectRatios,
  getScene,
  getStylePreset,
  luxuryScenes,
  stylePresets,
  type AspectRatio,
} from "@/lib/scenes";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const generateSchema = z.object({
  scene: z.string().refine((value) => luxuryScenes.some((scene) => scene.id === value)),
  style: z.string().refine((value) => stylePresets.some((style) => style.id === value)),
  aspectRatio: z
    .string()
    .refine((value): value is AspectRatio =>
      aspectRatios.includes(value as AspectRatio)
    ),
  customPrompt: z.string().max(500).optional(),
});

export const runtime = "nodejs";
export const maxDuration = 60;

async function uploadGeneratedImage(input: {
  url: string;
  userId: string;
  jobId: string;
}) {
  const response = await fetch(input.url);

  if (!response.ok) {
    throw new Error("Unable to download generated image from fal.ai.");
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  const outputPath = input.userId + "/" + input.jobId + "/output.jpg";
  const admin = getSupabaseAdmin();

  const { error } = await admin.storage
    .from("outputs")
    .upload(outputPath, await response.blob(), {
      contentType,
      upsert: true,
    });

  if (error) {
    throw error;
  }

  const { data } = await admin.storage
    .from("outputs")
    .createSignedUrl(outputPath, 60 * 60 * 24 * 7);

  return {
    outputPath,
    outputUrl: data?.signedUrl ?? input.url,
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (
    error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }

  return "Generation failed.";
}

export async function POST(request: Request) {
  const providers = getProviderStatus();

  if (
    !providers.supabase ||
    !providers.supabaseAdmin ||
    !providers.anthropic ||
    !providers.fal
  ) {
    return NextResponse.json(
      { error: "Image generation providers are not configured." },
      { status: 503 }
    );
  }

  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const formData = await request.formData();
  const selfie = formData.get("selfie");

  if (!(selfie instanceof File)) {
    return NextResponse.json({ error: "Selfie image is required." }, { status: 400 });
  }

  if (!isSupportedMimeType(selfie.type)) {
    return NextResponse.json(
      { error: "Use a JPG, PNG, WebP, or GIF selfie." },
      { status: 400 }
    );
  }

  if (selfie.size > MAX_SELFIE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Selfie must be under 10 MB." },
      { status: 400 }
    );
  }

  const parsed = generateSchema.safeParse({
    scene: formData.get("scene"),
    style: formData.get("style"),
    aspectRatio: formData.get("aspectRatio"),
    customPrompt: formData.get("customPrompt") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid generation settings." }, { status: 400 });
  }

  const scene = getScene(parsed.data.scene);
  const style = getStylePreset(parsed.data.style);
  const jobId = crypto.randomUUID();
  const sourcePath =
    userId +
    "/" +
    jobId +
    "/source." +
    extensionForMimeType(selfie.type);
  const admin = getSupabaseAdmin();
  let creditConsumed = false;

  try {
    await admin.from("generation_jobs").insert({
      id: jobId,
      user_id: userId,
      status: "queued",
      scene: scene.id,
      style: style.id,
      aspect_ratio: parsed.data.aspectRatio,
      prompt: parsed.data.customPrompt ?? null,
      cost_cents: FAL_IMAGE_COST_CENTS,
    });

    const { data: balanceAfterCharge, error: creditError } = await supabase.rpc(
      "consume_credit_for_generation",
      {
        p_user_id: userId,
        p_job_id: jobId,
        p_description: "Generated " + scene.name + " / " + style.name,
        p_cost: 1,
      }
    );

    if (creditError) {
      throw creditError;
    }

    creditConsumed = true;

    const { error: uploadError } = await admin.storage
      .from("selfies")
      .upload(sourcePath, selfie, {
        contentType: selfie.type,
        upsert: false,
      });

    if (uploadError) {
      throw uploadError;
    }

    await admin
      .from("generation_jobs")
      .update({ status: "analyzing", source_path: sourcePath })
      .eq("id", jobId);

    const bytes = Buffer.from(await selfie.arrayBuffer());
    const analysis = await analyzeSelfie({
      base64: bytes.toString("base64"),
      mimeType: selfie.type,
      sceneName: scene.name,
      styleName: style.name,
    });
    const prompt = buildLuxuryPrompt({
      scene,
      style,
      aspectRatio: parsed.data.aspectRatio,
      customPrompt: parsed.data.customPrompt,
      analysis,
    });

    const { data: signedSource } = await admin.storage
      .from("selfies")
      .createSignedUrl(sourcePath, 60 * 60);

    if (!signedSource?.signedUrl) {
      throw new Error("Unable to create signed selfie URL.");
    }

    await admin
      .from("generation_jobs")
      .update({ status: "generating", final_prompt: prompt })
      .eq("id", jobId);

    const falResult = await generateKontextImage({
      prompt,
      imageUrl: signedSource.signedUrl,
      aspectRatio: parsed.data.aspectRatio,
    });

    const generatedImage = falResult.data.images[0];

    if (!generatedImage?.url) {
      throw new Error("fal.ai did not return an image URL.");
    }

    const output = await uploadGeneratedImage({
      url: generatedImage.url,
      userId,
      jobId,
    });

    const completedJob = {
      id: jobId,
      status: "completed" as const,
      scene: scene.id,
      style: style.id,
      aspectRatio: parsed.data.aspectRatio,
      outputUrl: output.outputUrl,
      error: null,
      createdAt: new Date().toISOString(),
    };

    await admin
      .from("generation_jobs")
      .update({
        status: "completed",
        output_path: output.outputPath,
        output_url: output.outputUrl,
        fal_request_id: falResult.requestId,
      })
      .eq("id", jobId);

    return NextResponse.json({
      id: jobId,
      status: "completed",
      outputUrl: output.outputUrl,
      balanceAfter: balanceAfterCharge ?? 0,
      job: completedJob,
    });
  } catch (error) {
    const message = getErrorMessage(error);
    const status = message.toLowerCase().includes("insufficient credits") ? 402 : 500;

    if (creditConsumed) {
      await admin.rpc("refund_credit_for_failed_generation", {
        p_user_id: userId,
        p_job_id: jobId,
        p_description: "Refund for failed generation " + jobId,
        p_amount: 1,
      });
    }

    await admin
      .from("generation_jobs")
      .update({ status: "failed", error: message })
      .eq("id", jobId);

    return NextResponse.json({ error: message }, { status });
  }
}
