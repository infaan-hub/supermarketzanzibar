// Device-camera barcode scanner.
//
// Uses ZXing through the browser's MediaDevices API. Hardware keyboard-wedge
// scanners keep working through the normal barcode inputs; this component adds
// a camera option for phones, tablets and webcams.
//
// The component asks for camera permission only when the user starts it, stops
// the media tracks when it is closed or unmounted, and reports common camera
// failures (permission denied, no camera, insecure origin, ...) in plain text.

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  BrowserMultiFormatReader as BrowserMultiFormatReaderType,
  IScannerControls,
} from "@zxing/browser";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface BarcodeCameraScannerProps {
  /** Called with the normalized text of each decoded barcode. */
  onScan: (barcode: string) => boolean | void | Promise<boolean | void>;
  disabled?: boolean;
  /** Keep the camera open after a successful scan (useful at the POS). */
  continuous?: boolean;
  /** Play a short confirmation beep for every accepted scan. */
  beepOnScan?: boolean;
  className?: string;
  startLabel?: string;
  /** Text shown under the live camera preview. */
  activeHint?: string;
}

type ScannerStatus = "idle" | "starting" | "active";

// A repeated code is only accepted again after it has been out of view for a
// moment. This makes one physical presentation count once while still allowing
// the same product to be scanned repeatedly for stock counting.
const CODE_REARM_MS = 1000;

function playBeep(context: AudioContext | null): void {
  if (!context) return;

  try {
    if (context.state === "suspended") void context.resume();

    const start = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(1200, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(0.16, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.12);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + 0.14);
  } catch {
    // Audio is a nicety; scanning must keep working without it.
  }

  try {
    navigator.vibrate?.(60);
  } catch {
    // Vibration is optional.
  }
}

function describeCameraError(error: unknown): string {
  const name =
    error instanceof DOMException
      ? error.name
      : typeof error === "object" && error !== null && "name" in error
        ? String((error as { name: unknown }).name)
        : "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "Camera permission was denied. Allow camera access in your browser settings and try again.";
    case "NotFoundError":
    case "DevicesNotFoundError":
      return "No camera was found on this device.";
    case "NotReadableError":
    case "TrackStartError":
      return "The camera is already in use by another application.";
    case "OverconstrainedError":
    case "ConstraintNotSatisfiedError":
      return "This camera does not support the requested video mode.";
    case "SecurityError":
      return "Camera access requires HTTPS or localhost.";
    case "NotSupportedError":
      return "This browser does not support camera barcode scanning.";
    default:
      return error instanceof Error
        ? error.message
        : "Unable to start the camera.";
  }
}

function cameraIsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    window.isSecureContext &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}

export function BarcodeCameraScanner({
  onScan,
  disabled = false,
  continuous = false,
  beepOnScan = false,
  className,
  startLabel = "Scan with camera",
  activeHint = "Point the camera at a barcode.",
}: BarcodeCameraScannerProps) {
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [startRequest, setStartRequest] = useState(0);
  // Assume support during SSR/hydration; update after mounting.
  const [supported, setSupported] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserMultiFormatReaderType | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const runIdRef = useRef(0);
  const processingRef = useRef(false);
  const lastCodeRef = useRef<string | null>(null);
  const lastMissAtRef = useRef(0);
  const armedRef = useRef(true);

  const onScanRef = useRef(onScan);
  const continuousRef = useRef(continuous);
  const beepOnScanRef = useRef(beepOnScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    continuousRef.current = continuous;
  }, [continuous]);

  useEffect(() => {
    beepOnScanRef.current = beepOnScan;
  }, [beepOnScan]);

  useEffect(() => {
    setSupported(cameraIsSupported());
  }, []);

  const stopCamera = useCallback(() => {
    // Invalidate a permission request that is still resolving.
    runIdRef.current += 1;

    const controls = controlsRef.current;
    controlsRef.current = null;
    try {
      controls?.stop();
    } catch {
      // The stream may already be closed by the browser.
    }

    const video = videoRef.current;
    if (video) video.srcObject = null;

    const audio = audioContextRef.current;
    audioContextRef.current = null;
    if (audio) void audio.close().catch(() => undefined);

    setStatus("idle");
  }, []);

  const startCamera = useCallback(() => {
    setError(null);

    if (typeof window === "undefined") return;

    if (disabled) return;

    if (!window.isSecureContext) {
      setError("Camera access requires HTTPS or localhost.");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera scanning is not supported in this browser.");
      return;
    }

    // Create/resume the audio context during the click so the scan beep is
    // allowed by browsers that block audio until a user gesture.
    if (!audioContextRef.current) {
      try {
        const context = new AudioContext();
        audioContextRef.current = context;
        void context.resume().catch(() => undefined);
      } catch {
        audioContextRef.current = null;
      }
    }

    runIdRef.current += 1;
    setStatus("starting");
    setStartRequest((value) => value + 1);
  }, [disabled]);

  useEffect(() => {
    if (disabled && status !== "idle") stopCamera();
  }, [disabled, status, stopCamera]);

  // Starting is driven by a request counter instead of `status` so a pending
  // permission prompt can be cancelled without restarting the effect.
  useEffect(() => {
    if (startRequest === 0) return;

    const runId = runIdRef.current;
    const video = videoRef.current;
    if (!video) {
      setStatus("idle");
      setError("The camera preview could not be created.");
      return;
    }

    let disposed = false;

    void (async () => {
      try {
        const { BrowserMultiFormatReader, BarcodeFormat } = await import(
          "@zxing/browser"
        );

        if (disposed || runId !== runIdRef.current) return;

        const reader = new BrowserMultiFormatReader(undefined, {
          delayBetweenScanAttempts: 200,
          delayBetweenScanSuccess: 300,
        });
        // Product labels are one-dimensional codes. Restricting the formats
        // avoids accidentally accepting a marketing QR code as stock data.
        reader.possibleFormats = [
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.ITF,
          BarcodeFormat.CODABAR,
        ];
        readerRef.current = reader;

        const controls = await reader.decodeFromVideoDevice(
          undefined,
          video,
          (result, decodeError, callbackControls) => {
            if (!result) {
              // The code must leave the frame for a moment before the same
              // value can be counted again.
              if (!armedRef.current && decodeError) {
                if (lastMissAtRef.current === 0) {
                  lastMissAtRef.current = Date.now();
                } else if (Date.now() - lastMissAtRef.current >= CODE_REARM_MS) {
                  armedRef.current = true;
                  lastMissAtRef.current = 0;
                }
              }
              return;
            }

            if (processingRef.current) return;

            const barcode = result.getText().trim();
            if (!barcode) return;

            lastMissAtRef.current = 0;

            if (!armedRef.current && barcode === lastCodeRef.current) {
              return;
            }

            lastCodeRef.current = barcode;
            armedRef.current = false;
            processingRef.current = true;
            setLastScan(barcode);
            setError(null);

            void Promise.resolve(onScanRef.current(barcode))
              .then((accepted) => {
                if (accepted !== false && beepOnScanRef.current) {
                  playBeep(audioContextRef.current);
                }
              })
              .catch((scanError: unknown) => {
                setError(
                  scanError instanceof Error
                    ? scanError.message
                    : "The barcode could not be processed.",
                );
              })
              .finally(() => {
                processingRef.current = false;

                if (!continuousRef.current) {
                  try {
                    callbackControls.stop();
                  } catch {
                    // Already stopped.
                  }
                  if (controlsRef.current === callbackControls) {
                    controlsRef.current = null;
                  }
                  setStatus("idle");
                }
              });
          },
        );

        if (disposed || runId !== runIdRef.current) {
          controls.stop();
          return;
        }

        controlsRef.current = controls;
        setStatus("active");
      } catch (scanError) {
        if (disposed || runId !== runIdRef.current) return;

        controlsRef.current = null;
        readerRef.current = null;
        setStatus("idle");
        setError(describeCameraError(scanError));
      }
    })();

    return () => {
      disposed = true;
      runIdRef.current += 1;

      const controls = controlsRef.current;
      controlsRef.current = null;
      try {
        controls?.stop();
      } catch {
        // Already stopped.
      }

      readerRef.current = null;
      video.srcObject = null;

      const audio = audioContextRef.current;
      audioContextRef.current = null;
      if (audio) void audio.close().catch(() => undefined);
    };
  }, [startRequest]);

  useEffect(() => {
    return () => {
      runIdRef.current += 1;
      try {
        controlsRef.current?.stop();
      } catch {
        // Already stopped.
      }
      controlsRef.current = null;
      readerRef.current = null;

      const audio = audioContextRef.current;
      audioContextRef.current = null;
      if (audio) void audio.close().catch(() => undefined);
    };
  }, []);

  return (
    <div className={cn("space-y-2", className)}>
      {status === "idle" ? (
        <Button
          type="button"
          variant="secondary"
          onClick={startCamera}
          disabled={disabled}
        >
          <span aria-hidden="true">📷</span>
          {startLabel}
        </Button>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-black">
          <div className="relative">
            <video
              ref={videoRef}
              className="h-56 w-full object-cover sm:h-64"
              autoPlay
              muted
              playsInline
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex items-center justify-center p-8"
            >
              <div className="h-full w-full rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 border-t border-border bg-background p-3">
            <p className="text-xs text-muted" aria-live="polite">
              {status === "starting" ? "Starting camera…" : activeHint}
            </p>
            <Button type="button" variant="secondary" size="sm" onClick={stopCamera}>
              Stop camera
            </Button>
          </div>
        </div>
      )}

      {!supported && status === "idle" && (
        <p className="text-xs text-muted">
          Camera scanning needs a supported browser on HTTPS or localhost.
        </p>
      )}

      {lastScan && (
        <p className="text-xs text-muted">
          Last camera scan:{" "}
          <span className="font-mono text-foreground">{lastScan}</span>
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-md border border-danger/20 bg-danger/10 p-2.5 text-sm text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}
