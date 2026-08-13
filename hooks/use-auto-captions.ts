"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type CaptionMode = "off" | "on" | "auto-en";

type UseAutoCaptionsOptions = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  enabled: boolean;
  chunkMs?: number;
};

type CaptionsStatus = {
  text: string;
  pending: boolean;
  error: string | null;
  configured: boolean | null;
};

function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg",
  ];
  return candidates.find((c) => MediaRecorder.isTypeSupported(c));
}

/** Capture live video audio in chunks and translate speech → English captions. */
export function useAutoCaptions({
  videoRef,
  enabled,
  chunkMs = 5500,
}: UseAutoCaptionsOptions): CaptionsStatus {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState<boolean | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const busyRef = useRef(false);
  const aliveRef = useRef(true);

  const stopCapture = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const transcribeChunk = useCallback(async (blob: Blob) => {
    if (!aliveRef.current || blob.size < 1200 || busyRef.current) return;
    busyRef.current = true;
    setPending(true);
    try {
      const body = new FormData();
      body.append("audio", blob, `live.${blob.type.includes("mp4") ? "mp4" : "webm"}`);
      const res = await fetch("/api/captions", { method: "POST", body });
      const data = (await res.json().catch(() => null)) as {
        text?: string;
        error?: string;
        configured?: boolean;
        skipped?: boolean;
      } | null;

      if (res.status === 503) {
        setConfigured(false);
        setError(data?.error || "Captions API not configured");
        return;
      }
      if (!res.ok) {
        setError(data?.error || "Caption request failed");
        return;
      }

      setConfigured(true);
      setError(null);
      if (data?.skipped) return;
      const next = (data?.text || "").trim();
      if (next) setText(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Caption request failed");
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setPending(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopCapture();
    };
  }, [stopCapture]);

  useEffect(() => {
    if (!enabled) {
      stopCapture();
      setText("");
      setPending(false);
      setError(null);
      return;
    }

    let cancelled = false;

    const start = async () => {
      const video = videoRef.current;
      if (!video) return;

      if (typeof (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream !== "function") {
        setError("Auto captions need a browser that supports video.captureStream()");
        return;
      }

      try {
        const status = await fetch("/api/captions", { cache: "no-store" }).then(
          (r) => r.json() as Promise<{ configured?: boolean }>,
        );
        if (cancelled) return;
        setConfigured(Boolean(status.configured));
        if (!status.configured) {
          setError(
            "Add OPENAI_API_KEY or GROQ_API_KEY to .env for auto English captions",
          );
          return;
        }
      } catch {
        // continue; POST will surface errors
      }

      let media: MediaStream;
      try {
        media = (
          video as HTMLVideoElement & { captureStream: () => MediaStream }
        ).captureStream();
      } catch {
        setError("Unable to capture audio from this stream");
        return;
      }

      const audioTracks = media.getAudioTracks();
      if (!audioTracks.length) {
        setError("No audio track available for captions");
        return;
      }

      const audioOnly = new MediaStream(audioTracks);
      streamRef.current = audioOnly;
      const mime = pickRecorderMime();
      if (!mime || typeof MediaRecorder === "undefined") {
        setError("MediaRecorder is not supported in this browser");
        return;
      }

      const loop = () => {
        if (cancelled || !aliveRef.current) return;
        const videoEl = videoRef.current;
        if (!videoEl || videoEl.paused || videoEl.readyState < 2) {
          timerRef.current = setTimeout(loop, 1200);
          return;
        }

        let recorder: MediaRecorder;
        try {
          recorder = new MediaRecorder(audioOnly, { mimeType: mime });
        } catch {
          setError("Unable to start caption recorder");
          return;
        }

        recorderRef.current = recorder;
        const chunks: BlobPart[] = [];
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunks.push(e.data);
        };
        recorder.onstop = () => {
          if (cancelled) return;
          const blob = new Blob(chunks, { type: mime });
          void transcribeChunk(blob);
          if (!cancelled && aliveRef.current && enabled) {
            timerRef.current = setTimeout(loop, 250);
          }
        };

        try {
          recorder.start();
        } catch {
          setError("Caption recorder failed to start");
          return;
        }

        timerRef.current = setTimeout(() => {
          if (recorder.state === "recording") {
            try {
              recorder.stop();
            } catch {
              // ignore
            }
          }
        }, chunkMs);
      };

      loop();
    };

    void start();

    return () => {
      cancelled = true;
      stopCapture();
    };
  }, [enabled, videoRef, chunkMs, stopCapture, transcribeChunk]);

  return { text, pending, error, configured };
}

export function cycleCaptionMode(mode: CaptionMode): CaptionMode {
  if (mode === "off") return "on";
  if (mode === "on") return "auto-en";
  return "off";
}

export function captionModeLabel(mode: CaptionMode): string {
  if (mode === "off") return "CC Off";
  if (mode === "on") return "CC On";
  return "Auto EN";
}
