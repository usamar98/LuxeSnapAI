import type { SelfieAnalysis } from "@/lib/anthropic";
import type { AspectRatio, luxuryScenes, stylePresets } from "@/lib/scenes";

export const MAX_SELFIE_SIZE_BYTES = 10 * 1024 * 1024;

export const supportedMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export type SupportedMimeType = (typeof supportedMimeTypes)[number];

export function isSupportedMimeType(value: string): value is SupportedMimeType {
  return supportedMimeTypes.includes(value as SupportedMimeType);
}

export function extensionForMimeType(mimeType: SupportedMimeType) {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return "jpg";
}

export function buildLuxuryPrompt(input: {
  scene: (typeof luxuryScenes)[number];
  style: (typeof stylePresets)[number];
  aspectRatio: AspectRatio;
  customPrompt?: string;
  analysis: SelfieAnalysis;
}) {
  const extraDirection = input.customPrompt
    ? "User direction: " + input.customPrompt + "."
    : "";

  return [
    "Ultra-realistic luxury lifestyle photo edit of the same person from the reference selfie.",
    "Preserve identity faithfully: " + input.analysis.identityNotes,
    "Place the person " + input.scene.prompt + ".",
    "Style direction: " + input.style.prompt + ". " + input.analysis.styling,
    "Lighting: " + input.analysis.lighting,
    "Camera: " + input.analysis.camera,
    extraDirection,
    "Aspect ratio " + input.aspectRatio + ".",
    "Natural skin texture, anatomically realistic hands, believable fabric, real camera optics.",
    "No brand logos, no readable text, no watermark, no celebrity resemblance, no extra people, no face distortion, no plastic skin.",
  ]
    .filter(Boolean)
    .join(" ");
}
