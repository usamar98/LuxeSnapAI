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
} from "lucide-react";

import type { DashboardJob, InitialDashboardState } from "@/lib/app-types";
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
      return "Camera permission was blocked. Allow camera access or upload a selfie file.";
    }

    if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
      return "No camera was found on this device. Upload a selfie file instead.";
    }
  }

  return error instanceof Error
    ? error.message
    : "Camera permission was blocked or no camera was found.";
}

export function LuxeSnapApp({
  initialState,
}: {
  initialState: InitialDashboardState;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
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
  const canGenerate = Boolean(file && initialState.user && liveReady && !isGenerating);

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

  function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setMessage(null);
    setCameraError(null);

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(nextFile ? URL.createObjectURL(nextFile) : null);
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
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 1600 },
        },
      });

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

        handleFileChange(capturedFile);
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
      <div className="mx-auto flex min-h-screen w-full max-w-[1480px] flex-col gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg border border-border bg-card/70 p-3 shadow-2xl shadow-black/20 backdrop-blur md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg border border-primary/25 bg-primary text-primary-foreground">
              <CrownIcon />
            </div>
            <div>
              <p className="text-xl font-semibold">LuxeSnap AI</p>
              <p className="text-sm text-muted-foreground">
                Luxury scene editor for creator-grade AI photos
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary" className="gap-1">
              <CoinsIcon data-icon="inline-start" />
              {credits} credits
            </Badge>
            <Button variant="outline" onClick={() => handleCheckout("creator")}>
              <SparklesIcon data-icon="inline-start" />
              Buy credits
            </Button>
            {initialState.user ? (
              <form action="/auth/sign-out" method="post">
                <Button type="submit" variant="ghost">
                  <LogOutIcon data-icon="inline-start" />
                  Sign out
                </Button>
              </form>
            ) : (
              <Button onClick={() => router.push("/auth/login")}>
                <LockIcon data-icon="inline-start" />
                Sign in
              </Button>
            )}
          </div>
        </header>

        <section className="grid flex-1 gap-5 lg:grid-cols-[330px_minmax(0,1fr)_360px]">
          <Card className="border-border/80 bg-card/82 shadow-2xl shadow-black/25">
            <CardHeader>
              <CardTitle>Source</CardTitle>
              <CardDescription>
                One selfie becomes a polished luxury lifestyle shot.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-5">
              <div
                className={cn(
                  "relative flex aspect-[4/5] w-full overflow-hidden rounded-lg border border-dashed border-border bg-muted text-left transition",
                  previewUrl && !isCameraOpen && "border-primary/40",
                  isCameraOpen && "border-primary/60"
                )}
              >
                {isCameraOpen ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="h-full w-full scale-x-[-1] object-cover"
                  />
                ) : previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrl}
                    alt="Selected selfie preview"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 p-6 text-center">
                    <div className="flex size-12 items-center justify-center rounded-lg border border-border bg-background/80 text-muted-foreground">
                      <CameraIcon />
                    </div>
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-medium">Add a selfie</span>
                      <span className="text-xs text-muted-foreground">
                        Take a live photo or choose an image file
                      </span>
                    </div>
                    <div className="grid w-full max-w-64 grid-cols-1 gap-2 sm:grid-cols-2">
                      <Button
                        type="button"
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
                      <Button type="button" variant="outline" onClick={openFilePicker}>
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
                  handleFileChange(event.target.files?.item(0) ?? null);
                }}
              />

              {previewUrl || isCameraOpen ? (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={isCameraOpen ? "secondary" : "default"}
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
                  <Button type="button" variant="outline" onClick={openFilePicker}>
                    <ImagePlusIcon data-icon="inline-start" />
                    Upload file
                  </Button>
                </div>
              ) : null}

              {isCameraOpen ? (
                <Button type="button" variant="secondary" onClick={captureCameraSelfie}>
                  <CameraIcon data-icon="inline-start" />
                  Capture selfie
                </Button>
              ) : null}

              {cameraError ? (
                <p className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {cameraError}
                </p>
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
                disabled={!canGenerate}
                onClick={handleGenerate}
                className="h-11"
              >
                {isGenerating ? (
                  <Loader2Icon data-icon="inline-start" className="animate-spin" />
                ) : (
                  <WandSparklesIcon data-icon="inline-start" />
                )}
                {needsAuth
                  ? "Sign in to generate"
                  : file
                    ? "Generate luxury edit"
                    : "Add selfie"}
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

          <Card className="border-border/80 bg-card/82 shadow-2xl shadow-black/25">
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
                className="grid w-full grid-cols-1 items-stretch gap-3 md:grid-cols-2 xl:grid-cols-3"
              >
                {luxuryScenes.map((scene) => (
                  <ToggleGroupItem
                    key={scene.id}
                    value={scene.id}
                    variant="outline"
                    className="h-auto min-h-40 justify-start overflow-hidden border-border bg-card p-0 text-left aria-pressed:border-primary/70 aria-pressed:bg-primary/10"
                  >
                    <span
                      className="relative flex min-h-40 w-full flex-col justify-end overflow-hidden rounded-lg bg-cover"
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
                          className="justify-start aria-pressed:border-primary/70 aria-pressed:bg-primary/10"
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
                      className="grid w-full grid-cols-5 gap-1"
                      spacing={1}
                    >
                      {aspectRatios.map((ratio) => (
                        <ToggleGroupItem
                          key={ratio}
                          value={ratio}
                          variant="outline"
                          className="px-1.5 aria-pressed:border-primary/70 aria-pressed:bg-primary/10"
                        >
                          {ratio}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                  </Field>
                </FieldGroup>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
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

          <Card className="border-border/80 bg-card/82 shadow-2xl shadow-black/25">
            <CardHeader>
              <CardTitle>Output</CardTitle>
              <CardDescription>
                Review the latest render and generation activity.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="preview" className="gap-5">
                <TabsList className="w-full">
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="history">History</TabsTrigger>
                  <TabsTrigger value="credits">Credits</TabsTrigger>
                </TabsList>

                <TabsContent value="preview" className="flex flex-col gap-4">
                  <div className="relative flex aspect-[4/5] overflow-hidden rounded-lg border border-border bg-muted">
                    {resultUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resultUrl}
                        alt="Generated LuxeSnap AI result"
                        className="h-full w-full object-cover"
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
                  <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
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
                      className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 p-3 text-left transition hover:border-primary/60 hover:bg-primary/10"
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
