"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { sceneHasNewItem } from "@/lib/visual-item-detection";

export interface VisualItemCameraCounterProps {
  onDetect: () => boolean | void | Promise<boolean | void>;
  disabled?: boolean;
  className?: string;
  startLabel?: string;
}

type CameraStatus = "idle" | "starting" | "active";
const SAMPLE_SIZE = 32;
const FRAME_INTERVAL_MS = 180;
const REQUIRED_ITEM_FRAMES = 3;
const REQUIRED_CLEAR_FRAMES = 5;

function sampleCenter(video: HTMLVideoElement, canvas: HTMLCanvasElement, context: CanvasRenderingContext2D) {
  const sourceWidth = video.videoWidth;
  const sourceHeight = video.videoHeight;
  if (sourceWidth === 0 || sourceHeight === 0) return null;

  const cropSize = Math.min(sourceWidth, sourceHeight) * 0.72;
  const sourceX = (sourceWidth - cropSize) / 2;
  const sourceY = (sourceHeight - cropSize) / 2;
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  context.drawImage(video, sourceX, sourceY, cropSize, cropSize, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  const rgba = context.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
  const grayscale = new Uint8Array(SAMPLE_SIZE * SAMPLE_SIZE);
  for (let pixel = 0, channel = 0; pixel < grayscale.length; pixel += 1, channel += 4) {
    grayscale[pixel] = Math.round(
      rgba[channel] * 0.299 + rgba[channel + 1] * 0.587 + rgba[channel + 2] * 0.114,
    );
  }
  return grayscale;
}

function beep(context: AudioContext | null) {
  if (!context) return;
  try {
    if (context.state === "suspended") void context.resume();
    const start = context.currentTime;
    const tone = context.createOscillator();
    const volume = context.createGain();
    tone.type = "sine";
    tone.frequency.setValueAtTime(1100, start);
    volume.gain.setValueAtTime(0.001, start);
    volume.gain.exponentialRampToValueAtTime(0.18, start + 0.015);
    volume.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
    tone.connect(volume);
    volume.connect(context.destination);
    tone.start(start);
    tone.stop(start + 0.17);
  } catch {
    // Sound is optional; keep visual counting available if audio is blocked.
  }
  try {
    navigator.vibrate?.(60);
  } catch {
    // Haptics are optional.
  }
}

function cameraMessage(error: unknown): string {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "Camera access was denied. Allow camera access in your browser settings and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "No camera was found on this device.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera is already in use by another application.";
  }
  if (name === "SecurityError") return "Camera access requires HTTPS or localhost.";
  return error instanceof Error ? error.message : "Unable to start the camera.";
}

export function VisualItemCameraCounter({
  onDetect,
  disabled = false,
  className,
  startLabel = "Open camera & count units",
}: VisualItemCameraCounterProps) {
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [itemInView, setItemInView] = useState(false);
  const [hint, setHint] = useState("Keep the camera still and present one item at a time.");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const audioRef = useRef<AudioContext | null>(null);
  const runRef = useRef(0);
  const onDetectRef = useRef(onDetect);
  const backgroundRef = useRef<Uint8Array | null>(null);
  const occupiedRef = useRef(false);
  const itemFramesRef = useRef(0);
  const clearFramesRef = useRef(0);
  const lastFrameAtRef = useRef(0);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  const stopCamera = useCallback(() => {
    runRef.current += 1;
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    backgroundRef.current = null;
    occupiedRef.current = false;
    itemFramesRef.current = 0;
    clearFramesRef.current = 0;
    setItemInView(false);
    setStatus("idle");

    const audio = audioRef.current;
    audioRef.current = null;
    if (audio) void audio.close().catch(() => undefined);
  }, []);

  const startCamera = useCallback(async () => {
    if (disabled || status !== "idle") return;
    setError(null);
    if (!window.isSecureContext) {
      setError("Camera access requires HTTPS or localhost.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera scanning is not supported in this browser.");
      return;
    }

    const run = ++runRef.current;
    setStatus("starting");
    setItemInView(false);
    setHint("Hold the camera steady over an empty view to calibrate.");
    backgroundRef.current = null;
    occupiedRef.current = false;
    itemFramesRef.current = 0;
    clearFramesRef.current = 0;

    try {
      try {
        audioRef.current = new AudioContext();
        void audioRef.current.resume().catch(() => undefined);
      } catch {
        audioRef.current = null;
      }

      let stream: MediaStream;
      try {
        // Call getUserMedia in the click handler for mobile browser compatibility.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
      } catch (cameraError) {
        const name =
          typeof cameraError === "object" && cameraError !== null && "name" in cameraError
            ? String((cameraError as { name: unknown }).name)
            : "";
        if (name !== "OverconstrainedError" && name !== "NotFoundError") throw cameraError;
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true });
      }

      if (run !== runRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("The camera preview could not be created.");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      if (video.videoWidth === 0) {
        await new Promise<void>((resolve, reject) => {
          const timeout = window.setTimeout(() => reject(new Error("The camera did not provide a video frame.")), 8000);
          video.addEventListener("loadeddata", () => {
            window.clearTimeout(timeout);
            resolve();
          }, { once: true });
        });
      }
      if (run !== runRef.current) return;

      setStatus("active");
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d", { willReadFrequently: true });
      if (!canvas || !context) throw new Error("Visual item detection is not supported in this browser.");

      const detectFrame = (timestamp: number) => {
        if (run !== runRef.current) return;
        frameRef.current = requestAnimationFrame(detectFrame);
        if (timestamp - lastFrameAtRef.current < FRAME_INTERVAL_MS) return;
        lastFrameAtRef.current = timestamp;

        try {
          const sample = sampleCenter(video, canvas, context);
          if (!sample) return;
          const background = backgroundRef.current;
          if (!background) {
            backgroundRef.current = sample;
            setHint("Ready. Place one item in the center frame.");
            return;
          }

          const changed = sceneHasNewItem(sample, background);
          if (!occupiedRef.current) {
            if (changed) {
              itemFramesRef.current += 1;
            } else {
              itemFramesRef.current = 0;
              // Gradually adapt to small exposure changes while the frame is clear.
              for (let i = 0; i < background.length; i += 1) {
                background[i] = Math.round(background[i] * 0.92 + sample[i] * 0.08);
              }
            }

            if (itemFramesRef.current >= REQUIRED_ITEM_FRAMES) {
              occupiedRef.current = true;
              clearFramesRef.current = 0;
              setItemInView(true);
              setHint("Item detected. Remove it from the frame to count the next one.");
              void Promise.resolve(onDetectRef.current())
                .then((accepted) => {
                  if (accepted !== false) beep(audioRef.current);
                })
                .catch((detectError: unknown) => {
                  setError(detectError instanceof Error ? detectError.message : "Unable to count the detected item.");
                });
            }
          } else if (!changed) {
            clearFramesRef.current += 1;
            if (clearFramesRef.current >= REQUIRED_CLEAR_FRAMES) {
              occupiedRef.current = false;
              itemFramesRef.current = 0;
              clearFramesRef.current = 0;
              backgroundRef.current = sample;
              setItemInView(false);
              setHint("Ready. Place the next item in the center frame.");
            }
          } else {
            clearFramesRef.current = 0;
          }
        } catch (detectError) {
          setError(detectError instanceof Error ? detectError.message : "Unable to read the camera frame.");
        }
      };

      frameRef.current = requestAnimationFrame(detectFrame);
    } catch (cameraError) {
      if (run !== runRef.current) return;
      setError(cameraMessage(cameraError));
      stopCamera();
      setError(cameraMessage(cameraError));
    }
  }, [disabled, status, stopCamera]);

  useEffect(() => {
    if (disabled && status !== "idle") stopCamera();
  }, [disabled, status, stopCamera]);

  useEffect(() => {
    return () => {
      runRef.current += 1;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach((track) => track.stop());
      const audio = audioRef.current;
      audioRef.current = null;
      if (audio) void audio.close().catch(() => undefined);
    };
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      {status === "idle" && (
        <Button type="button" variant="secondary" onClick={() => void startCamera()} disabled={disabled}>
          <span aria-hidden="true">📷</span>
          {startLabel}
        </Button>
      )}
      <div className={status === "idle" ? "hidden" : "overflow-hidden rounded-lg border border-border bg-black"}>
        <div className="relative">
          <video ref={videoRef} className="h-56 w-full object-cover sm:h-64" autoPlay muted playsInline />
          <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
          {status === "active" && (
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
              <div className={cn(
                "h-full w-full rounded-lg border-2 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)] transition-colors",
                itemInView ? "border-success" : "border-white/80",
              )} />
            </div>
          )}
          {status === "starting" && (
            <p className="absolute inset-x-3 bottom-3 rounded bg-black/70 p-2 text-center text-xs text-white">
              {hint}
            </p>
          )}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-border bg-background p-3">
          <p className="text-xs text-muted" aria-live="polite">{status === "starting" ? "Starting camera…" : hint}</p>
          <Button type="button" variant="secondary" size="sm" onClick={stopCamera}>Stop camera</Button>
        </div>
      </div>
      {error && <p role="alert" className="rounded-md border border-danger/20 bg-danger/10 p-2.5 text-sm text-danger">{error}</p>}
    </div>
  );
}
