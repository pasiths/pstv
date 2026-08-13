"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { Loader2, Volume2, VolumeX, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { proxiedStreamUrl } from "@/lib/utils";

type HlsPlayerProps = {
  src: string;
  title?: string;
  pip?: boolean;
  /** Default true — IPTV streams almost always need CORS proxy. */
  useProxy?: boolean;
};

export function HlsPlayer({
  src,
  title,
  pip = false,
  useProxy = true,
}: HlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const playSrc = useProxy ? proxiedStreamUrl(src) : src;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playSrc) return;

    let cancelled = false;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;
    setReady(false);
    setBuffering(true);
    setError(null);

    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setReady(true);
    };
    const onCanPlay = () => {
      setBuffering(false);
      setReady(true);
    };

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);

    const showFatal = (message: string) => {
      if (cancelled) return;
      setError(message);
      setBuffering(false);
      setReady(false);
    };

    const startPlayback = async () => {
      loadTimeout = setTimeout(() => {
        if (!cancelled && !video.played.length) {
          showFatal(
            `Timed out loading${title ? ` ${title}` : ""}. Try another channel or Retry.`,
          );
        }
      }, 18_000);

      try {
        // Safari / iOS native HLS
        if (video.canPlayType("application/vnd.apple.mpegurl") && !Hls.isSupported()) {
          video.src = playSrc;
          await video.play().catch(() => undefined);
          return;
        }

        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
            backBufferLength: 60,
            maxBufferLength: 30,
            maxMaxBufferLength: 60,
            startLevel: -1,
            capLevelToPlayerSize: true,
            progressive: true,
            xhrSetup: (xhr) => {
              xhr.withCredentials = false;
            },
          });
          hlsRef.current = hls;
          hls.loadSource(playSrc);
          hls.attachMedia(video);

          hls.on(Hls.Events.MANIFEST_PARSED, async (_e, data) => {
            if (cancelled) return;
            // Prefer a mid/low quality start for faster first frame
            if (data.levels.length > 1) {
              hls.startLevel = Math.min(1, data.levels.length - 1);
            }
            setReady(true);
            setBuffering(false);
            try {
              await video.play();
            } catch {
              // muted autoplay should work
            }
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (cancelled) return;
            if (!data.fatal) {
              if (data.details === "bufferStalledError") setBuffering(true);
              return;
            }

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
              console.warn("[HlsPlayer] network error, retrying…", data);
              hls.startLoad();
              setTimeout(() => {
                if (!cancelled && video.readyState < 2) {
                  showFatal(
                    `Network error${title ? ` on ${title}` : ""}. Stream may be offline or geo-blocked.`,
                  );
                }
              }, 8000);
              return;
            }

            if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
              console.warn("[HlsPlayer] media error, recovering…", data);
              hls.recoverMediaError();
              return;
            }

            showFatal(
              `Unable to play${title ? ` ${title}` : ""}. The stream may be offline or blocked.`,
            );
            hls.destroy();
          });
          return;
        }

        // Fallback: native tag
        video.src = playSrc;
        await video.play().catch(() => undefined);
      } catch {
        showFatal(
          `Unable to play${title ? ` ${title}` : ""}. The stream may be offline or blocked.`,
        );
      }
    };

    void startPlayback();

    return () => {
      cancelled = true;
      if (loadTimeout) clearTimeout(loadTimeout);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.removeAttribute("src");
      video.load();
    };
  }, [playSrc, title, reloadToken]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
  }, [muted]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !pip) return;
    if (document.pictureInPictureElement === video) return;
    void video.requestPictureInPicture?.().catch(() => undefined);
    return () => {
      if (document.pictureInPictureElement === video) {
        void document.exitPictureInPicture?.().catch(() => undefined);
      }
    };
  }, [pip]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border/60 bg-black shadow-lg">
      {(!ready || buffering) && !error && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-black/55 text-muted-foreground">
          <Loader2 className="size-8 animate-spin text-teal-400" />
          <p className="text-xs">
            {ready ? "Buffering…" : `Loading${title ? ` ${title}` : ""}…`}
          </p>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center text-sm text-red-300">
          <p>{error}</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setError(null);
              setReady(false);
              setBuffering(true);
              setReloadToken((n) => n + 1);
            }}
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}
      <video
        ref={videoRef}
        className="absolute inset-0 size-full bg-black object-contain"
        controls
        playsInline
        muted={muted}
        autoPlay
        preload="auto"
      />
      <div className="absolute top-3 right-3 z-20 flex gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="bg-black/60 text-white hover:bg-black/80"
          onClick={() => {
            setMuted((m) => !m);
            void videoRef.current?.play();
          }}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
          {muted ? "Unmute" : "Mute"}
        </Button>
      </div>
    </div>
  );
}
