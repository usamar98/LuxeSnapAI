import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

import { getRequiredEnv } from "@/lib/env";

const analysisSchema = z.object({
  identityNotes: z.string().min(8),
  lighting: z.string().min(4),
  camera: z.string().min(4),
  styling: z.string().min(4),
  safetyNotes: z.string().optional(),
});

export type SelfieAnalysis = z.infer<typeof analysisSchema>;

let anthropicClient: Anthropic | null = null;

function getAnthropic() {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: getRequiredEnv("ANTHROPIC_API_KEY"),
    });
  }

  return anthropicClient;
}

function extractText(content: Anthropic.Messages.Message["content"]) {
  return content
    .filter((block) => block.type === "text")
    .map((block) => ("text" in block ? block.text : ""))
    .join("\n");
}

function extractJsonObject(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

export async function analyzeSelfie(input: {
  base64: string;
  mimeType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  sceneName: string;
  styleName: string;
}) {
  const client = getAnthropic();

  const message = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
    max_tokens: 700,
    system:
      "You are a production photo direction assistant. Analyze the uploaded selfie only for visual traits needed to preserve the same person in an AI edit. Do not identify the person, infer sensitive attributes, or name anyone. Return compact JSON only.",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: input.mimeType,
              data: input.base64,
            },
          },
          {
            type: "text",
            text:
              "Create safe image-editing direction for LuxeSnap AI. Target scene: " +
              input.sceneName +
              ". Style: " +
              input.styleName +
              '. Return JSON with keys "identityNotes", "lighting", "camera", "styling", and "safetyNotes".',
          },
        ],
      },
    ],
  });

  const rawText = extractText(message.content);
  const parsed = analysisSchema.safeParse(JSON.parse(extractJsonObject(rawText)));

  if (!parsed.success) {
    return {
      identityNotes:
        "Preserve the same face shape, skin texture, hairstyle, expression, and natural proportions from the selfie without over-smoothing.",
      lighting: "Match face lighting to the new luxury scene with realistic shadows.",
      camera: "Use a natural portrait lens and believable perspective.",
      styling: "Keep personal style close to the source image while upgrading wardrobe subtly.",
      safetyNotes: "Do not add logos, text, watermarks, or celebrity resemblance.",
    } satisfies SelfieAnalysis;
  }

  return parsed.data;
}
