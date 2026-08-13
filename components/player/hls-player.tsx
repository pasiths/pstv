"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import {
  Loader2,
  Volume2,
  VolumeX,
  RefreshCw,
  Maximize,
  Minimize,
  Pause,
  Play,
  Radio,
  PictureInPicture2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn, proxiedStreamUrl } from "@/lib/utils";

type HlsPlayerProps = {
  src: string;
  title?: string;
  category?: string;
  country?: string;
  pip?: boolean;
  useProxy?: boolean;
  onPipToggle?: () => void;
};

export function HlsPlayer({
  src,
  title,
  category,
  country,
  pip = false,
  useProxy = true,
  onPipToggle,
}: HlsPlayerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);

  const playSrc = useProxy ? proxiedStreamUrl(src) : src;

  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (playing && !error) setControlsVisible(false);
    }, 2800);
  }, [playing, error]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !playSrc) return;

    let cancelled = false;
    let loadTimeout: ReturnType<typeof setTimeout> | null = null;
    setReady(false);
    setBuffering(true);
    setError(null);
    setPlaying(false);
    setControlsVisible(true);

    const onWaiting = () => setBuffering(true);
    const onPlaying = () => {
      setBuffering(false);
      setReady(true);
      setPlaying(true);
    };
    const onPause = () => setPlaying(false);
    const onCanPlay = () => {
      setBuffering(false);
      setReady(true);
    };

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("pause", onPause);
    video.addEventListener("canplay", onCanPlay);

    const showFatal = (message: string) => {
      if (cancelled) return;
      setError(message);
      setBuffering(false);
      setReady(false);
      setControlsVisible(true);
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
        if (
          video.canPlayType("application/vnd.apple.mpegurl") &&
          !Hls.isSupported()
        ) {
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
            if (data.levels.length > 1) {
              hls.startLevel = Math.min(1, data.levels.length - 1);
            }
            setReady(true);
            setBuffering(false);
            try {
              await video.play();
            } catch {
              // muted autoplay
            }
          });

          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (cancelled) return;
            if (!data.fatal) {
              if (data.details === "bufferStalledError") setBuffering(true);
              return;
            }

            if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
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
      video.removeEventListener("pause", onPause);
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
    const onFs = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

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

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    bumpControls();
    if (video.paused) await video.play().catch(() => undefined);
    else video.pause();
  };

  const toggleFullscreen = async () => {
    const shell = shellRef.current;
    if (!shell) return;
    bumpControls();
    if (!document.fullscreenElement) {
      await shell.requestFullscreen?.().catch(() => undefined);
    } else {
      await document.exitFullscreen?.().catch(() => undefined);
    }
  };

  return (
    <div
      ref={shellRef}
      className={cn(
        "player-shell group/player relative aspect-video w-full overflow-hidden",
        "rounded-2xl border border-white/10 bg-[#05080c]",
        "shadow-[0_24px_80px_-32px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)]",
        controlsVisible ? "cursor-default" : "cursor-none",
      )}
      onMouseMove={bumpControls}
      onMouseLeave={() => {
        if (playing && !error) setControlsVisible(false);
      }}
      onClick={bumpControls}
    >
      {/* subtle frame glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-teal-500/15"
      />

      <video
        ref={videoRef}
        className="absolute inset-0 size-full bg-black object-contain"
        playsInline
        muted={muted}
        autoPlay
        preload="auto"
        onClick={(e) => {
          e.stopPropagation();
          void togglePlay();
        }}
      />

      {/* top gradient + meta */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 via-black/35 to-transparent px-4 pt-4 pb-16 transition-opacity duration-300",
          controlsVisible || !ready || error ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-white uppercase shadow-sm">
                <span className="size-1.5 animate-pulse rounded-full bg-white" />
                Live
              </span>
              {category && (
                <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/75 backdrop-blur-sm">
                  {category}
                </span>
              )}
              {country && (
                <span className="rounded-md border border-white/15 bg-white/5 px-2 py-0.5 text-[10px] text-white/75 backdrop-blur-sm">
                  {country}
                </span>
              )}
            </div>
            {title && (
              <h2 className="truncate font-heading text-lg font-semibold tracking-tight text-white drop-shadow sm:text-xl">
                {title}
              </h2>
            )}
          </div>
          <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
            <span className="hidden items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-500/10 px-2.5 py-1 text-[10px] font-medium tracking-wide text-teal-200 uppercase sm:inline-flex">
              <Radio className="size-3" />
              FluxTV
            </span>
          </div>
        </div>
      </div>

      {/* loading */}
      {(!ready || buffering) && !error && (
        <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-[#05080c]/55 backdrop-blur-[2px]">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-teal-400/20" />
            <div className="relative flex size-14 items-center justify-center rounded-full border border-teal-400/30 bg-black/50">
              <Loader2 className="size-6 animate-spin text-teal-300" />
            </div>
          </div>
          <p className="text-xs tracking-wide text-white/70">
            {ready ? "Buffering stream…" : `Tuning${title ? ` ${title}` : ""}…`}
          </p>
        </div>
      )}

      {/* error */}
      {error && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-[#0a0f14]/92 px-6 text-center backdrop-blur-sm">
          <div className="flex size-12 items-center justify-center rounded-full border border-red-400/30 bg-red-500/10">
            <Radio className="size-5 text-red-300" />
          </div>
          <p className="max-w-md text-sm text-red-100/90">{error}</p>
          <Button
            type="button"
            size="sm"
            className="bg-teal-600 text-white hover:bg-teal-500"
            onClick={() => {
              setError(null);
              setReady(false);
              setBuffering(true);
              setReloadToken((n) => n + 1);
            }}
          >
            <RefreshCw className="size-3.5" />
            Retry channel
          </Button>
        </div>
      )}

      {/* bottom controls */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 pt-16 pb-3 transition-all duration-300 sm:px-4 sm:pb-4",
          controlsVisible || !ready || error
            ? "translate-y-0 opacity-100"
            : "translate-y-2 opacity-0 pointer-events-none",
        )}
      >
        <div className="mb-3 h-0.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-2/5 animate-pulse rounded-full bg-gradient-to-r from-teal-500/80 to-teal-300/50" />
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <ControlButton
              label={playing ? "Pause" : "Play"}
              onClick={() => void togglePlay()}
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </ControlButton>
            <ControlButton
              label={muted ? "Unmute" : "Mute"}
              onClick={() => {
                setMuted((m) => !m);
                void videoRef.current?.play();
                bumpControls();
              }}
            >
              {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
              <span className="hidden text-xs sm:inline">
                {muted ? "Unmute" : "Mute"}
              </span>
            </ControlButton>
          </div>

          <div className="flex items-center gap-1.5">
            {onPipToggle && (
              <ControlButton
                label="Picture in picture"
                active={pip}
                onClick={() => {
                  onPipToggle();
                  bumpControls();
                }}
              >
                <PictureInPicture2 className="size-4" />
              </ControlButton>
            )}
            <ControlButton
              label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? (
                <Minimize className="size-4" />
              ) : (
                <Maximize className="size-4" />
              )}
            </ControlButton>
          </div>
        </div>
      </div>
    </div>
  );
}

function ControlButton({
  children,
  label,
  onClick,
  active,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-lg border px-2.5 text-white transition",
        "border-white/10 bg-white/5 hover:bg-white/15 hover:border-white/20",
        "backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/50",
        active && "border-teal-400/40 bg-teal-500/20 text-teal-100",
      )}
    >
      {children}
    </button>
  );
}
