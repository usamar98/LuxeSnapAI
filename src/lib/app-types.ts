import type { AspectRatio, SceneId, StylePresetId } from "@/lib/scenes";
import type { ProviderStatus } from "@/lib/env";

export type DashboardUser = {
  id: string;
  email: string | null;
  credits: number;
};

export type DashboardJob = {
  id: string;
  status: "queued" | "analyzing" | "generating" | "completed" | "failed";
  scene: SceneId | string;
  style: StylePresetId | string;
  aspectRatio: AspectRatio | string;
  outputUrl: string | null;
  error: string | null;
  createdAt: string;
};

export type InitialDashboardState = {
  providers: ProviderStatus;
  user: DashboardUser | null;
  jobs: DashboardJob[];
  demo: boolean;
};
