import { fal } from "@fal-ai/client";

import { getRequiredEnv } from "@/lib/env";
import type { AspectRatio } from "@/lib/scenes";

let configured = false;

type FalImage = {
  url: string;
  width?: number;
  height?: number;
  content_type?: string;
  file_name?: string;
  file_size?: number;
};

export type FalKontextResult = {
  images: FalImage[];
  prompt?: string;
  seed?: number;
  has_nsfw_concepts?: boolean[];
};

function getFalClient() {
  if (!configured) {
    fal.config({
      credentials: getRequiredEnv("FAL_KEY"),
    });
    configured = true;
  }

  return fal;
}

export async function generateKontextImage(input: {
  prompt: string;
  imageUrl: string;
  aspectRatio: AspectRatio;
}) {
  const client = getFalClient();
  const result = await client.subscribe("fal-ai/flux-pro/kontext", {
    input: {
      prompt: input.prompt,
      image_url: input.imageUrl,
      aspect_ratio: input.aspectRatio,
      guidance_scale: 3.5,
      num_images: 1,
      output_format: "jpeg",
      safety_tolerance: "2",
      enhance_prompt: true,
    },
    logs: true,
  });

  return {
    data: result.data as FalKontextResult,
    requestId: result.requestId,
  };
}
