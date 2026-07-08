"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CameraIcon,
  CheckCircle2Icon,
  CoinsIcon,
  CrownIcon,
  ImagePlusIcon,
  Loader2Icon,
  LockIcon,
  LogOutIcon,
  PlaneIcon,
  SparklesIcon,
  WandSparklesIcon,
  XIcon,
} from "lucide-react";

import type { DashboardJob, InitialDashboardState } from "@/lib/app-types";
import {
  MAX_SELFIE_SIZE_BYTES,
  isSupportedMimeType,
  type SupportedMimeType,
} from "@/lib/generation";
import { creditPacks } from "@/lib/plans";
import {
  aspectRatios,
  getScene,
  getStylePreset,
  luxuryScenes,
  stylePresets,
  type AspectRatio,
  type SceneId,
  type StylePresetId,
} from "@/lib/scenes";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

type GenerateResponse = {
  id: string;
  status: DashboardJob["status"];
  outputUrl: string | null;
  balanceAfter: number;
  job: DashboardJob;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function statusLabel(status: DashboardJob["status"]) {
  if (status === "completed") return "Ready";
  if (status === "failed") return "Failed";
  if (status === "analyzing") return "Analyzing";
  if (status === "generating") return "Generating";
  return "Queued";
}

function providerReady(initialState: InitialDashboardState) {
  return (
    initialState.providers.supabase &&
    initialState.providers.supabaseAdmin &&
    initialState.providers.anthropic &&
    initialState.providers.fal
  );
}

function cameraErrorMessage(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
      return "Camera is blocked for this site. Tap the browser camera icon or open site settings, allow Camera, reload, then try Take photo again.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera was found. Enable a webcam, use your phone camera, or choose Upload file.";
    }

    if (error.name === "NotReadableError" || error.name === "TrackStartError") {
      return "The browser cannot start the webcam. Close other camera apps, check Windows camera privacy settings, then try again or use Upload file.";
    }

    if (error.name === "OverconstrainedError" || error.name === "ConstraintNotSatisfiedError") {
      return "This camera does not support the requested selfie mode. Try again or use Upload file.";
    }

    if (error.name === "SecurityError") {
      return "Camera is blocked by browser security. Open LuxeSnap AI directly in a secure HTTPS browser tab and allow camera access.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Camera could not start. Check browser camera permissions or use Upload file.";
}

const imageMimeTypesByExtension: Record<string, SupportedMimeType> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

function fileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

function withInferredMimeType(file: File) {
  if (file.type) return file;

  const mimeType = imageMimeTypesByExtension[fileExtension(file)];
  return mimeType
    ? new File([file], file.name, {
        type: mimeType,
        lastModified: file.lastModified,
      })
    : file;
}

function loadLocalImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This photo format could not be opened in your browser."));
    };
    image.src = url;
  });
}

async function normalizeSelfieFile(originalFile: File) {
  const file = withInferredMimeType(originalFile);
  const extension = fileExtension(file);
  const isApplePhoto =
    file.type === "image/heic" ||
    file.type === "image/heif" ||
    extension === "heic" ||
    extension === "heif";

  if (isSupportedMimeType(file.type) && file.size <= MAX_SELFIE_SIZE_BYTES) {
    return file;
  }

  if (!isApplePhoto && file.size <= MAX_SELFIE_SIZE_BYTES) {
    throw new Error("Use a JPG, PNG, WebP, GIF, HEIC, or HEIF selfie.");
  }

  let image: HTMLImageElement;

  try {
    image = await loadLocalImage(file);
  } catch {
    if (isApplePhoto) {
      throw new Error(
        "This browser could not convert the iPhone photo. Take a new picture with Phone camera, or switch iPhone Camera Formats to Most Compatible."
      );
    }

    throw new Error("This large photo could not be optimized. Choose another image.");
  }

  const maxDimension = 2400;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("This photo could not be prepared for upload.");
  }

  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", 0.9);
  });

  if (!blob || blob.size > MAX_SELFIE_SIZE_BYTES) {
    throw new Error("This photo is still too large. Choose an image under 10 MB.");
  }

  const baseName = file.name.replace(/\.[^.]+$/, "") || "selfie";
  return new File([blob], baseName + ".jpg", {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

const cameraConstraints: MediaStreamConstraints[] = [
  {
    audio: false,
    video: { facingMode: { ideal: "user" } },
  },
  {
    audio: false,
    video: true,
  },
];

export function LuxeSnapApp({
  initialState,
}: {
  initialState: InitialDashboardState;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [sceneId, setSceneId] = useState<SceneId>("private-jet");
  const [styleId, setStyleId] = useState<StylePresetId>("editorial");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [customPrompt, setCustomPrompt] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isCameraStarting, setIsCameraStarting] = useState(false);
  const [isPreparingSelfie, setIsPreparingSelfie] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(
    initialState.jobs.find((job) => job.outputUrl)?.outputUrl ?? null
  );
  const [jobs, setJobs] = useState<DashboardJob[]>(initialState.jobs);
  const [credits, setCredits] = useState(initialState.user?.credits ?? 0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(16);

  const liveReady = providerReady(initialState);
  const selectedScene = useMemo(() => getScene(sceneId), [sceneId]);
  const selectedStyle = useMemo(() => getStylePreset(styleId), [styleId]);
  const needsAuth = !initialState.user;
  const isGenerateBusy = isGenerating || isPreparingSelfie;

  useEffect(() => {
    return () => {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    if (videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
    }
  }, [isCameraOpen]);
  function stopCamera() {
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    setIsCameraOpen(false);
    setIsCameraStarting(false);
  }

  function openFilePicker() {
    stopCamera();
    fileInputRef.current?.click();
  }

  function openMobileCameraPicker() {
    stopCamera();
    mobileCaptureInputRef.current?.click();
  }

  async function handleFileChange(nextFile: File | null) {
    setMessage(null);
    setCameraError(null);

    if (!nextFile) {
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      return;
    }

    setIsPreparingSelfie(true);

    try {
      const normalizedFile = await normalizeSelfieFile(nextFile);
      setFile(normalizedFile);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(normalizedFile));

      if (normalizedFile !== nextFile) {
        setMessage("Photo optimized for a reliable upload.");
      }
    } catch (error) {
      setFile(null);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setMessage(error instanceof Error ? error.message : "Photo could not be prepared.");
    } finally {
      setIsPreparingSelfie(false);
    }
  }

  async function startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera capture is not available in this browser.");
      return;
    }

    setCameraError(null);
    setIsCameraStarting(true);

    try {
      stopCamera();
      let lastError: unknown = null;
      let stream: MediaStream | null = null;

      for (const constraints of cameraConstraints) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (error) {
          lastError = error;

          if (
            error instanceof DOMException &&
            (error.name === "NotAllowedError" ||
              error.name === "PermissionDeniedError" ||
              error.name === "SecurityError")
          ) {
            break;
          }
        }
      }

      if (!stream) {
        throw lastError ?? new Error("Camera could not start.");
      }

      cameraStreamRef.current = stream;
      setIsCameraOpen(true);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
    } catch (error) {
      setCameraError(cameraErrorMessage(error));
      stopCamera();
    } finally {
      setIsCameraStarting(false);
    }
  }

  function captureCameraSelfie() {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setCameraError("Camera preview is still loading. Try again in a moment.");
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");

    if (!context) {
      setCameraError("Unable to capture from this camera.");
      return;
    }

    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setCameraError("Unable to save the captured selfie.");
          return;
        }

        const capturedFile = new File(
          [blob],
          "camera-selfie-" + Date.now() + ".jpg",
          { type: "image/jpeg" }
        );

        void handleFileChange(capturedFile);
        stopCamera();
        setMessage("Camera selfie captured. Choose a scene and generate.");
      },
      "image/jpeg",
      0.92
    );
  }
  async function handleGenerate() {
    if (needsAuth) {
      router.push("/auth/login");
      return;
    }

    if (!file) {
      setMessage("Add a selfie before generating.");
      return;
    }

    if (!liveReady) {
      setMessage("Live generation is waiting on provider environment variables.");
      return;
    }

    if (credits < 1) {
      await handleCheckout("starter");
      return;
    }

    setIsGenerating(true);
    setMessage(null);
    setProgress(28);

    const ticker = window.setInterval(() => {
      setProgress((current) => Math.min(current + 9, 88));
    }, 900);

    try {
      const formData = new FormData();
      formData.set("selfie", file);
      formData.set("scene", sceneId);
      formData.set("style", styleId);
      formData.set("aspectRatio", aspectRatio);
      formData.set("customPrompt", customPrompt);

      const response = await fetch("/api/generate", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as
        | GenerateResponse
        | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? payload.error : "Generation failed.");
      }

      setProgress(100);
      const successPayload = payload as GenerateResponse;
      setResultUrl(successPayload.outputUrl);
      setCredits(successPayload.balanceAfter);
      setJobs((current) => [successPayload.job, ...current].slice(0, 8));
      setMessage("Your luxury edit is ready.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Generation failed.");
    } finally {
      window.clearInterval(ticker);
      setIsGenerating(false);
      window.setTimeout(() => setProgress(16), 900);
    }
  }

  async function handleCheckout(planId: string) {
    if (needsAuth) {
      router.push("/auth/login");
      return;
    }

    try {
      const response = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });
      const payload = (await response.json()) as { url?: string; error?: string };

      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? "Checkout failed.");
      }

      window.location.href = payload.url;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Checkout failed.");
    }
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-3 px-3 py-3 sm:gap-5 sm:px-6 sm:py-4 lg:px-8">
        <header className="flex flex-col gap-3 rounded-lg border border-border bg-card/70 p-3 shadow-2xl shadow-black/20 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary text-primary-foreground sm:size-10">
              <CrownIcon />
            </div>
            <div>
              <p className="text-lg font-semibold sm:text-xl">LuxeSnap AI</p>
              <p className="text-xs text-muted-foreground sm:text-sm">
                Luxury scene editor for creator-grade AI photos
              </p>
            </div>
          </div>

          <div className="grid grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] gap-2 sm:flex sm:flex-wrap sm:items-center">
            <Badge
              variant="secondary"
              className="min-h-11 justify-center gap-1 px-2 sm:min-h-0"
            >
              <CoinsIcon data-icon="inline-start" />
              {initialState.user ? `${credits} credits` : "Credits"}
            </Badge>
            <Button
              variant="outline"
              className="h-11 min-w-0 w-full px-2 sm:h-8 sm:w-auto"
              onClick={() => handleCheckout("creator")}
            >
              <SparklesIcon data-icon="inline-start" />
              Buy credits
            </Button>
            {initialState.user ? (
              <form action="/auth/sign-out" method="post" className="w-full sm:w-auto">
                <Button type="submit" variant="ghost" className="h-11 w-full sm:h-8 sm:w-auto">
                  <LogOutIcon data-icon="inline-start" />
                  Sign out
                </Button>
              </form>
            ) : (
              <Button className="h-11 w-full sm:h-8 sm:w-auto" onClick={() => router.push("/auth/login")}>
                <LockIcon data-icon="inline-start" />
                Sign in
              </Button>
            )}
          </div>
        </header>

        <section className="grid items-start gap-4 sm:gap-5 xl:grid-cols-[300px_minmax(0,1fr)_330px] 2xl:grid-cols-[330px_minmax(0,1fr)_360px]">
          <Card className="h-fit overflow-visible border-border/80 bg-card/82 shadow-2xl shadow-black/25">
            <CardHeader>
              <CardTitle>Source</CardTitle>
              <CardDescription>
                One selfie becomes a polished luxury lifestyle shot.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div
                data-camera-open={isCameraOpen ? "true" : "false"}
                className={cn(
                  "relative mx-auto flex w-full overflow-hidden border border-dashed border-border bg-muted text-left transition",
                  isCameraOpen
                    ? "fixed inset-0 z-50 h-[100svh] max-h-none max-w-none bg-black border-0 rounded-none sm:relative sm:inset-auto sm:z-auto sm:aspect-[3/4] sm:h-auto sm:max-h-[640px] sm:max-w-md sm:rounded-lg sm:border"
                    : "aspect-[3/4] max-h-[min(70svh,640px)] max-w-md rounded-lg",
                  previewUrl && !isCameraOpen && "border-primary/40",
                  isCameraOpen && "sm:border-primary/60"
                )}
              >
                {isCameraOpen ? (
                  <>
                    <video
                      ref={videoRef}
                      autoPlay
                      muted
                      playsInline
                      className="h-full w-full scale-x-[-1] bg-black object-contain"
                    />
                    <div className="pointer-events-none absolute inset-x-0 top-0 flex justify-center bg-black/45 px-5 pb-8 pt-[calc(env(safe-area-inset-top)+1rem)] text-center text-sm text-white sm:hidden">
                      Keep your full head and shoulders inside the frame
                    </div>
                    <div className="absolute inset-x-0 bottom-0 grid grid-cols-[1fr_auto] gap-3 bg-black/55 px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-8 backdrop-blur-sm sm:hidden">
                      <Button
                        type="button"
                        size="lg"
                        className="h-14"
                        onClick={captureCameraSelfie}
                      >
                        <CameraIcon data-icon="inline-start" />
                        Capture selfie
                      </Button>
                      <Button
                        type="button"
                        size="icon-lg"
                        variant="secondary"
                        className="size-14"
                        onClick={stopCamera}
                        aria-label="Close camera"
                      >
                        <XIcon />
                      </Button>
                    </div>
                  </>
                ) : previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Selected selfie preview"
                    className="h-full w-full bg-black/35 object-contain"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-3 p-5 text-center sm:gap-4 sm:p-6">
                    <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-background/80 text-muted-foreground">
                      <CameraIcon />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">Add a selfie</span>
                      <span className="text-xs text-muted-foreground">
                        Take a live photo or choose an image file
                      </span>
                    </div>
                    <div className="grid w-full max-w-72 grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
                        className="h-11"
                        disabled={isCameraStarting}
                        onClick={startCamera}
                      >
                        {isCameraStarting ? (
                          <Loader2Icon
                            data-icon="inline-start"
                            className="animate-spin"
                          />
                        ) : (
                          <CameraIcon data-icon="inline-start" />
                        )}
                        Take photo
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 sm:hidden"
                        onClick={openMobileCameraPicker}
                      >
                        <CameraIcon data-icon="inline-start" />
                        Phone camera
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11"
                        onClick={openFilePicker}
                      >
                        <ImagePlusIcon data-icon="inline-start" />
                        Upload file
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <canvas ref={canvasRef} className="hidden" />
              <Input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  stopCamera();
                  void handleFileChange(event.target.files?.item(0) ?? null);
                  event.target.value = "";
                }}
              />
              <Input
                ref={mobileCaptureInputRef}
                type="file"
                accept="image/*"
                capture="user"
                className="hidden"
                onChange={(event) => {
                  stopCamera();
                  void handleFileChange(event.target.files?.item(0) ?? null);
                  event.target.value = "";
                }}
              />

              {previewUrl || isCameraOpen ? (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant={isCameraOpen ? "secondary" : "default"}
                    className="h-11"
                    disabled={isCameraStarting}
                    onClick={isCameraOpen ? stopCamera : startCamera}
                  >
                    {isCameraStarting ? (
                      <Loader2Icon data-icon="inline-start" className="animate-spin" />
                    ) : (
                      <CameraIcon data-icon="inline-start" />
                    )}
                    {isCameraOpen ? "Close camera" : "Take photo"}
                  </Button>
                  <Button type="button" variant="outline" className="h-11" onClick={openFilePicker}>
                    <ImagePlusIcon data-icon="inline-start" />
                    Upload file
                  </Button>
                  {!isCameraOpen ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="h-11 sm:hidden"
                      onClick={openMobileCameraPicker}
                    >
                      <CameraIcon data-icon="inline-start" />
                      Phone camera
                    </Button>
                  ) : null}
                </div>
              ) : null}

              {isCameraOpen ? (
                <Button
                  type="button"
                  variant="secondary"
                  className="hidden h-11 sm:inline-flex"
                  onClick={captureCameraSelfie}
                >
                  <CameraIcon data-icon="inline-start" />
                  Capture selfie
                </Button>
              ) : null}

              {cameraError ? (
                <div className="flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  <p>{cameraError}</p>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <Button type="button" size="sm" className="h-11 sm:h-7" onClick={startCamera}>
                      <CameraIcon data-icon="inline-start" />
                      Try again
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-11 sm:h-7" onClick={openFilePicker}>
                      <ImagePlusIcon data-icon="inline-start" />
                      Upload file
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-11 sm:hidden"
                      onClick={openMobileCameraPicker}
                    >
                      <CameraIcon data-icon="inline-start" />
                      Phone camera
                    </Button>
                  </div>
                </div>
              ) : null}

              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="direction">Direction</FieldLabel>
                  <Textarea
                    id="direction"
                    value={customPrompt}
                    onChange={(event) => setCustomPrompt(event.target.value)}
                    placeholder="Sharper suit, relaxed smile, sunset reflections"
                    className="min-h-24 resize-none"
                    maxLength={500}
                  />
                  <FieldDescription>
                    Claude turns this into photo direction before fal.ai renders.
                  </FieldDescription>
                </Field>
              </FieldGroup>

              <Button
                size="lg"
                disabled={isGenerateBusy}
                onClick={handleGenerate}
                className="h-12 w-full sm:h-11"
              >
                {isGenerating || isPreparingSelfie ? (
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <WandSparklesIcon data-icon="inline-start" />
                )}
                {isPreparingSelfie
                  ? "Preparing selfie"
                  : needsAuth
                    ? "Sign in to generate"
                    : !file
                      ? "Add selfie to generate"
                      : !liveReady
                        ? "Check generation setup"
                        : credits < 1
                          ? "Buy credits to generate"
                          : "Generate luxury edit"}
              </Button>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Generation</span>
                  <span>$0.04 fal.ai image cost</span>
                </div>
                <Progress value={isGenerating ? progress : 16} />
              </div>

              {message ? (
                <Alert>
                  <SparklesIcon />
                  <AlertTitle>Status</AlertTitle>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              ) : null}
            </CardContent>
          </Card>

          <Card className="h-fit overflow-visible border-border/80 bg-card/82 shadow-2xl shadow-black/25">
            <CardHeader className="gap-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle>Scene Studio</CardTitle>
                  <CardDescription>
                    Choose the world, style, and crop for the final image.
                  </CardDescription>
                </div>
                <Badge variant={liveReady ? "secondary" : "outline"}>
                  {liveReady ? "Live" : "Setup"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              <ToggleGroup

                value={[sceneId]}
                onValueChange={(value) => {
                  const next = value[0];
                  if (next) setSceneId(next as SceneId);
                }}
                className="grid w-full grid-cols-2 items-stretch gap-2 sm:grid-cols-3 md:gap-3"
              >
                {luxuryScenes.map((scene) => (
                  <ToggleGroupItem
                    key={scene.id}
                    value={scene.id}
                    variant="outline"
                    className="h-auto min-h-32 w-auto min-w-0 justify-start overflow-hidden border-border bg-card p-0 text-left aria-pressed:border-primary/70 aria-pressed:bg-primary/10 md:min-h-40"
                  >
                    <span
                      className="relative flex min-h-32 w-full flex-col justify-end overflow-hidden rounded-lg bg-cover md:min-h-40"
                      style={{
                        backgroundImage: "url('/assets/luxury-scenes.png')",
                        backgroundSize: "300% 200%",
                        backgroundPosition: scene.backgroundPosition,
                      }}
                    >
                      <span className="absolute inset-0 bg-gradient-to-t from-black/78 via-black/18 to-transparent" />
                      <span className="relative flex flex-col gap-1 p-4">
                        <span className="text-base font-semibold text-white">
                          {scene.name}
                        </span>
                        <span className="text-xs text-white/76">
                          {scene.caption}
                        </span>
                      </span>
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>

              <Separator />

              <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
                <FieldGroup>
                  <Field>
                    <FieldLabel>Style</FieldLabel>
                    <ToggleGroup
      
                      value={[styleId]}
                      onValueChange={(value) => {
                        const next = value[0];
                        if (next) setStyleId(next as StylePresetId);
                      }}
                      className="grid w-full grid-cols-2 gap-2"
                    >
                      {stylePresets.map((style) => (
                        <ToggleGroupItem
                          key={style.id}
                          value={style.id}
                          variant="outline"
                          className="min-h-11 justify-start aria-pressed:border-primary/70 aria-pressed:bg-primary/10 sm:min-h-8"
                        >
                          {style.name}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                </FieldGroup>

                <FieldGroup>
                  <Field>
                    <FieldLabel>Crop</FieldLabel>
                    <ToggleGroup
      
                      value={[aspectRatio]}
                      onValueChange={(value) => {
                        const next = value[0];
                        if (next) setAspectRatio(next as AspectRatio);
                      }}
                      className="grid w-full grid-cols-3 gap-1 sm:grid-cols-5"
                      spacing={1}
                    >
                      {aspectRatios.map((ratio) => (
                        <ToggleGroupItem
                          key={ratio}
                          value={ratio}
                          variant="outline"
                          className="min-h-11 px-1.5 aria-pressed:border-primary/70 aria-pressed:bg-primary/10 sm:min-h-8"
                        >
                          {ratio}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                </FieldGroup>
              </div>

              <div className="hidden gap-3 sm:grid md:grid-cols-3">
                <div className="rounded-lg border border-border bg-muted/35 p-4">
                  <PlaneIcon className="mb-3 text-primary" />
                  <p className="text-sm font-medium">{selectedScene.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {selectedScene.caption}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/35 p-4">
                  <CameraIcon className="mb-3 text-primary" />
                  <p className="text-sm font-medium">{selectedStyle.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Claude vision prompt pass
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-muted/35 p-4">
                  <CheckCircle2Icon className="mb-3 text-primary" />
                  <p className="text-sm font-medium">Identity hold</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Kontext edits from the selfie reference
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-fit overflow-visible border-border/80 bg-card/82 shadow-2xl shadow-black/25">
            <CardHeader>
              <CardTitle>Output</CardTitle>
              <CardDescription>
                Review the latest render and generation activity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="preview" className="gap-5">
                <TabsList className="h-11 w-full sm:h-8">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="credits">Credits</TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="flex flex-col gap-4">
                  <div
                    className="relative mx-auto flex w-full max-w-md overflow-hidden rounded-lg border border-border bg-muted"
                    style={{ aspectRatio: aspectRatio.replace(":", " / ") }}
                  >
                    {resultUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resultUrl}
                        alt="Generated LuxeSnap AI result"
                        className="h-full w-full bg-black/35 object-contain"
                      />
                    ) : (
                      <div
                        className="flex h-full w-full flex-col justify-end bg-cover p-5"
                        style={{
                          backgroundImage: "url('/assets/luxury-scenes.png')",
                          backgroundSize: "300% 200%",
                          backgroundPosition: selectedScene.backgroundPosition,
                        }}
                      >
                        <div className="rounded-lg border border-white/15 bg-black/54 p-4 text-white backdrop-blur">
                          <p className="text-sm font-semibold">
                            {selectedScene.name} render
                          </p>
                          <p className="mt-1 text-xs text-white/72">
                            Generated results appear here after checkout-ready auth.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs text-muted-foreground sm:grid-cols-2">
                    <div className="rounded-lg border border-border bg-muted/35 p-3">
                      Scene
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedScene.name}
                      </p>
                    </div>
                    <div className="rounded-lg border border-border bg-muted/35 p-3">
                      Style
                      <p className="mt-1 text-sm font-medium text-foreground">
                        {selectedStyle.name}
                      </p>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="history" className="flex flex-col gap-3">
                  {jobs.length ? (
                    jobs.map((job) => (
                      <div
                        key={job.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {getScene(job.scene).name} / {getStylePreset(job.style).name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(job.createdAt)}
                          </p>
                        </div>
                        <Badge
                          variant={job.status === "failed" ? "destructive" : "outline"}
                        >
                          {statusLabel(job.status)}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/30 p-5 text-sm text-muted-foreground">
                      No generations yet.
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="credits" className="flex flex-col gap-3">
                  {creditPacks.map((pack) => (
                    <button
                      key={pack.id}
                      type="button"
                      onClick={() => handleCheckout(pack.id)}
                      className="flex min-h-12 items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3 text-left transition hover:border-primary/60 hover:bg-primary/10"
                    >
                      <span>
                        <span className="block text-sm font-medium">{pack.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {pack.description}
                        </span>
                      </span>
                      <span className="text-sm font-semibold">
                        {"$" + (pack.priceCents / 100).toFixed(0)}
                      </span>
                    </button>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </section>
      </div>
    </main>
  );
}
