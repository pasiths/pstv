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
  Cast,
  Airplay,
  Check,
  Captions,
  CaptionsOff,
  Settings2,
  Volume1,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn, proxiedStreamUrl } from "@/lib/utils";
import {
  castHlsMedia,
  initCastContext,
  promptAirPlay,
  promptRemotePlayback,
  supportsAirPlay,
} from "@/lib/cast";
import {
  captionModeLabel,
  cycleCaptionMode,
  useAutoCaptions,
  type CaptionMode,
} from "@/hooks/use-auto-captions";

const CAPTION_MODE_KEY = "fluxtv_caption_mode";
const QUALITY_PREF_KEY = "fluxtv_quality_pref";

type QualityOption = {
  /** -1 = Auto ABR */
  index: number;
  label: string;
  height: number;
  bitrate: number;
};

function readCaptionMode(): CaptionMode {
  if (typeof window === "undefined") return "off";
  const raw = window.localStorage.getItem(CAPTION_MODE_KEY);
  if (raw === "on" || raw === "auto-en" || raw === "off") return raw;
  return "off";
}

function readQualityPref(): "auto" | number {
  if (typeof window === "undefined") return "auto";
  const raw = window.localStorage.getItem(QUALITY_PREF_KEY);
  if (!raw || raw === "auto") return "auto";
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : "auto";
}

function formatQualityLabel(height: number, bitrate: number): string {
  if (height >= 2100) return "4K";
  if (height >= 1000) return `${height}p`;
  if (height >= 700) return `${height}p`;
  if (height >= 400) return `${height}p`;
  if (height > 0) return `${height}p`;
  if (bitrate > 0) {
    const mbps = bitrate / 1_000_000;
    return mbps >= 1 ? `${mbps.toFixed(1)} Mbps` : `${Math.round(bitrate / 1000)} kbps`;
  }
  return "Source";
}

function pickLevelForPref(
  levels: QualityOption[],
  pref: "auto" | number,
): number {
  if (pref === "auto" || !levels.length) return -1;
  const exact = levels.find((l) => l.height === pref);
  if (exact) return exact.index;
  // Closest height at or below preferred, else nearest
  const sorted = [...levels].sort((a, b) => a.height - b.height);
  let best = sorted[0];
  for (const l of sorted) {
    if (l.height <= pref) best = l;
  }
  const above = sorted.find((l) => l.height >= pref);
  if (above && Math.abs(above.height - pref) < Math.abs(best.height - pref)) {
    return above.index;
  }
  return best.index;
}
type HlsPlayerProps = {
  src: string;
  title?: string;
  category?: string;
  country?: string;
  logoUrl?: string | null;
  pip?: boolean;
  useProxy?: boolean;
  onPipToggle?: () => void;
};

export function HlsPlayer({
  src,
  title,
  category,
  country,
  logoUrl,
  pip = false,
  useProxy = true,
  onPipToggle,
}: HlsPlayerProps) {
  const shellRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const captionConfigToastRef = useRef(false);

  const [ready, setReady] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [volume, setVolume] = useState(0.85);
  const lastVolumeRef = useRef(0.85);
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [reloadToken, setReloadToken] = useState(0);
  const [castAvailable, setCastAvailable] = useState(false);
  const [airPlayAvailable, setAirPlayAvailable] = useState(false);
  const [casting, setCasting] = useState(false);
  const [captionMode, setCaptionMode] = useState<CaptionMode>("off");
  const [streamCue, setStreamCue] = useState("");
  const [hasStreamSubs, setHasStreamSubs] = useState(false);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [qualityIndex, setQualityIndex] = useState(-1); // -1 = Auto
  const [activeHeight, setActiveHeight] = useState(0);
  const [qualityOpen, setQualityOpen] = useState(false);
  const qualityPrefRef = useRef<"auto" | number>("auto");

  const playSrc = useProxy ? proxiedStreamUrl(src) : src;
  const autoCaptions = useAutoCaptions({
    videoRef,
    enabled: captionMode === "auto-en",
  });

  useEffect(() => {
    setCaptionMode(readCaptionMode());
    qualityPrefRef.current = readQualityPref();
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(CAPTION_MODE_KEY, captionMode);
    } catch {
      // ignore
    }
  }, [captionMode]);

  useEffect(() => {
    if (!qualityOpen) return;
    const onDoc = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest("[data-quality-menu]")) return;
      setQualityOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [qualityOpen]);

  const bumpControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      if (playing && !error) {
        setControlsVisible(false);
        setQualityOpen(false);
      }
    }, 2800);
  }, [playing, error]);

  const applyQuality = useCallback(
    (index: number, height = 0) => {
      const hls = hlsRef.current;
      setQualityIndex(index);
      setQualityOpen(false);
      bumpControls();

      const pref: "auto" | number = index < 0 ? "auto" : height || "auto";
      qualityPrefRef.current = pref;
      try {
        window.localStorage.setItem(
          QUALITY_PREF_KEY,
          pref === "auto" ? "auto" : String(pref),
        );
      } catch {
        // ignore
      }

      if (!hls) {
        toast.message("Quality control needs HLS playback");
        return;
      }

      hls.currentLevel = index;
      if (index < 0) {
        toast.message("Quality: Auto");
      } else {
        const label =
          qualities.find((q) => q.index === index)?.label ||
          formatQualityLabel(height, 0);
        toast.message(`Quality: ${label}`);
      }
    },
    [bumpControls, qualities],
  );

  useEffect(() => {
    let cancelled = false;
    // Chromium browsers expose Cast; show the control as soon as we know the platform.
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const chromium =
      /Chrome|Chromium|Edg|CriOS/i.test(ua) && !/OPR|Opera|SamsungBrowser/i.test(ua);
    if (chromium) setCastAvailable(true);

    void initCastContext().then((ctx) => {
      if (cancelled) return;
      if (!ctx || !window.cast?.framework) {
        if (!chromium) setCastAvailable(false);
        return;
      }
      setCastAvailable(true);
      const onState = (e: { castState?: string }) => {
        const state = e.castState ?? ctx.getCastState();
        setCasting(state === window.cast?.framework?.CastState.CONNECTED);
      };
      ctx.addEventListener(
        window.cast.framework.CastContextEventType.CAST_STATE_CHANGED,
        onState,
      );
      onState({ castState: ctx.getCastState() });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.setAttribute("x-webkit-airplay", "allow");
    video.setAttribute("airplay", "allow");

    // Show AirPlay only when the WebKit picker exists (Safari / iOS / macOS).
    setAirPlayAvailable(supportsAirPlay(video));
  }, [ready]);

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
    setStreamCue("");
    setHasStreamSubs(false);
    setQualities([]);
    setQualityIndex(-1);
    setActiveHeight(0);
    setQualityOpen(false);

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
            // Allow manual quality picks; Auto still adapts via ABR.
            capLevelToPlayerSize: false,
            progressive: true,
            enableWebVTT: true,
            enableIMSC1: true,
            renderTextTracksNatively: true,
            xhrSetup: (xhr) => {
              xhr.withCredentials = false;
            },
          });
          hlsRef.current = hls;
          hls.subtitleDisplay = false;
          hls.subtitleTrack = -1;
          hls.loadSource(playSrc);
          hls.attachMedia(video);

          const syncSubtitleTracks = () => {
            const tracks = hls.subtitleTracks || [];
            setHasStreamSubs(tracks.length > 0);
          };

          const syncLevels = () => {
            const opts: QualityOption[] = (hls.levels || []).map((level, index) => {
              const height = level.height || 0;
              const bitrate = level.bitrate || 0;
              return {
                index,
                height,
                bitrate,
                label: formatQualityLabel(height, bitrate),
              };
            });
            // Highest first in the menu
            const sorted = [...opts].sort((a, b) => b.height - a.height || b.bitrate - a.bitrate);
            setQualities(sorted);
            const pref = qualityPrefRef.current;
            const chosen = pickLevelForPref(sorted, pref);
            hls.currentLevel = chosen;
            setQualityIndex(chosen);
            if (chosen >= 0) {
              const q = sorted.find((x) => x.index === chosen);
              setActiveHeight(q?.height || 0);
            } else if (hls.levels[hls.currentLevel]) {
              setActiveHeight(hls.levels[hls.currentLevel]?.height || 0);
            }
          };

          hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, syncSubtitleTracks);
          hls.on(Hls.Events.MANIFEST_PARSED, async (_e, data) => {
            if (cancelled) return;
            syncSubtitleTracks();
            syncLevels();
            void data;
            setReady(true);
            setBuffering(false);
            try {
              await video.play();
            } catch {
              // muted autoplay
            }
          });

          hls.on(Hls.Events.LEVEL_SWITCHED, (_e, data) => {
            if (cancelled) return;
            const level = hls.levels[data.level];
            setActiveHeight(level?.height || 0);
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
    video.volume = muted ? 0 : volume;
  }, [muted, volume]);

  const setVolumeLevel = useCallback(
    (next: number) => {
      const clamped = Math.min(1, Math.max(0, next));
      setVolume(clamped);
      if (clamped <= 0.001) {
        setMuted(true);
      } else {
        lastVolumeRef.current = clamped;
        setMuted(false);
      }
      bumpControls();
    },
    [bumpControls],
  );

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      if (m) {
        const restore = lastVolumeRef.current > 0.05 ? lastVolumeRef.current : 0.85;
        setVolume(restore);
        return false;
      }
      lastVolumeRef.current = volume > 0.05 ? volume : lastVolumeRef.current;
      return true;
    });
    bumpControls();
  }, [bumpControls, volume]);


  useEffect(() => {
    const hls = hlsRef.current;
    const video = videoRef.current;
    if (!video) return;

    const enableStreamSubs = captionMode === "on";
    if (hls) {
      const tracks = hls.subtitleTracks || [];
      setHasStreamSubs(tracks.length > 0);
      hls.subtitleDisplay = enableStreamSubs;
      hls.subtitleTrack = enableStreamSubs && tracks.length > 0 ? 0 : -1;
    }

    for (let i = 0; i < video.textTracks.length; i++) {
      const track = video.textTracks[i];
      track.mode = enableStreamSubs ? "showing" : "hidden";
    }

    if (!enableStreamSubs) setStreamCue("");
  }, [captionMode, ready, reloadToken]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || captionMode !== "on") return;

    const onCueChange = () => {
      let active = "";
      for (let i = 0; i < video.textTracks.length; i++) {
        const track = video.textTracks[i];
        const cues = track.activeCues;
        if (!cues?.length) continue;
        const parts: string[] = [];
        for (let j = 0; j < cues.length; j++) {
          const cue = cues[j] as TextTrackCue & { text?: string };
          if (cue.text) parts.push(cue.text);
        }
        if (parts.length) {
          active = parts.join(" ").replace(/\s+/g, " ").trim();
          break;
        }
      }
      setStreamCue(active);
    };

    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].addEventListener("cuechange", onCueChange);
    }
    video.textTracks.addEventListener("addtrack", onCueChange);
    onCueChange();

    return () => {
      for (let i = 0; i < video.textTracks.length; i++) {
        video.textTracks[i].removeEventListener("cuechange", onCueChange);
      }
      video.textTracks.removeEventListener("addtrack", onCueChange);
    };
  }, [captionMode, ready, reloadToken, playSrc]);

  useEffect(() => {
    if (captionMode !== "auto-en") {
      captionConfigToastRef.current = false;
      return;
    }
    if (autoCaptions.configured !== false || !autoCaptions.error) return;
    if (captionConfigToastRef.current) return;
    captionConfigToastRef.current = true;
    toast.error(autoCaptions.error);
  }, [captionMode, autoCaptions.configured, autoCaptions.error]);

  const captionText =
    captionMode === "auto-en"
      ? autoCaptions.text
      : captionMode === "on"
        ? streamCue
        : "";

  const toggleCaptions = () => {
    bumpControls();
    setCaptionMode((mode) => {
      const next = cycleCaptionMode(mode);
      if (next === "auto-en") {
        toast.message("Auto English captions on", {
          description: "Speech is translated to English every few seconds.",
        });
      } else if (next === "on") {
        toast.message(
          hasStreamSubs
            ? "Stream captions on"
            : "Captions on — this stream may not include subtitle tracks",
        );
      } else {
        toast.message("Captions off");
      }
      return next;
    });
  };

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

  const handleCast = async () => {
    bumpControls();
    toast.message("Connecting to Chromecast…");
    const result = await castHlsMedia({
      contentUrl: src,
      title: title || "FluxTV",
      subtitle: [category, country].filter(Boolean).join(" · ") || "Live TV",
      poster: logoUrl,
    });
    if (result.success) {
      setCasting(true);
      toast.success(
        result.deviceName
          ? `Casting to ${result.deviceName}`
          : "Casting to your TV",
      );
    } else {
      toast.error(result.error ?? "Cast failed");
    }
  };

  const handleAirPlay = async () => {
    bumpControls();
    const video = videoRef.current;
    if (supportsAirPlay(video)) {
      promptAirPlay(video);
      return;
    }
    const remote = await promptRemotePlayback(video);
    if (!remote.success) {
      toast.error(remote.error ?? "AirPlay / remote playback unavailable");
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
        if (playing && !error) {
          setControlsVisible(false);
          setQualityOpen(false);
        }
      }}
      onClick={bumpControls}
    >
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
        crossOrigin="anonymous"
        disableRemotePlayback={false}
        onClick={(e) => {
          e.stopPropagation();
          void togglePlay();
        }}
      />

      {(captionText || (captionMode === "auto-en" && autoCaptions.pending)) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-[25] flex justify-center px-4 sm:bottom-24">
          <div className="max-w-[min(92%,36rem)] rounded-md bg-black/75 px-3 py-2 text-center text-sm leading-snug text-white shadow-lg backdrop-blur-sm sm:text-base">
            {captionText || (
              <span className="inline-flex items-center gap-2 text-white/70">
                <Loader2 className="size-3.5 animate-spin" />
                Generating English captions…
              </span>
            )}
          </div>
        </div>
      )}

      {captionMode === "auto-en" && autoCaptions.error && (
        <div className="pointer-events-none absolute inset-x-0 top-20 z-[25] flex justify-center px-4">
          <p className="max-w-lg rounded-md border border-amber-400/30 bg-amber-950/70 px-3 py-1.5 text-center text-[11px] text-amber-100">
            {autoCaptions.error}
          </p>
        </div>
      )}

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/80 via-black/30 to-transparent px-4 pt-4 pb-14 transition-opacity duration-300",
          controlsVisible || !ready || error ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-md bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold tracking-[0.14em] text-white uppercase shadow-sm">
            <span className="size-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
          {casting && (
            <span className="inline-flex items-center gap-1.5 rounded-md bg-teal-600/90 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
              <Cast className="size-3" />
              Casting
            </span>
          )}
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
          <span className="hidden items-center gap-1.5 rounded-full border border-teal-400/25 bg-teal-500/10 px-2.5 py-1 text-[10px] font-medium tracking-wide text-teal-200 uppercase sm:inline-flex">
            <Radio className="size-3" />
            FluxTV
          </span>
        </div>
        {title && (
          <h2 className="truncate font-heading text-lg font-semibold tracking-tight text-white drop-shadow sm:text-xl">
            {title}
          </h2>
        )}
      </div>

      {!error && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          {!ready || buffering ? (
            <div className="flex flex-col items-center gap-2">
              <div className="relative flex size-16 items-center justify-center rounded-full border border-teal-400/35 bg-black/55 shadow-lg backdrop-blur-sm">
                <div className="absolute inset-0 animate-ping rounded-full bg-teal-400/15" />
                <Loader2 className="relative size-7 animate-spin text-teal-300" />
              </div>
              <p className="text-[11px] tracking-wide text-white/70">
                {ready ? "Buffering…" : "Loading…"}
              </p>
            </div>
          ) : !playing ? (
            <button
              type="button"
              aria-label="Play"
              className="pointer-events-auto flex size-16 items-center justify-center rounded-full border border-white/20 bg-black/55 text-white shadow-lg backdrop-blur-sm transition hover:scale-105 hover:bg-teal-600/80"
              onClick={(e) => {
                e.stopPropagation();
                void togglePlay();
              }}
            >
              <Play className="size-7 fill-current pl-0.5" />
            </button>
          ) : null}
        </div>
      )}

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

      <div
        className={cn(
          "absolute inset-x-0 bottom-0 z-30 transition-opacity duration-300",
          controlsVisible || !ready || error
            ? "opacity-100"
            : "pointer-events-none opacity-0",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-t from-black/90 via-black/55 to-transparent px-2 pb-2 pt-10 sm:px-3">
          <div className="flex items-center gap-0.5 sm:gap-1">
            <ControlButton
              label={playing ? "Pause" : "Play"}
              onClick={() => void togglePlay()}
            >
              {playing ? (
                <Pause className="size-[1.15rem]" />
              ) : (
                <Play className="size-[1.15rem] fill-current" />
              )}
            </ControlButton>

            <div className="group/vol flex items-center">
              <ControlButton
                label={muted || volume <= 0 ? "Unmute" : "Mute"}
                onClick={toggleMute}
              >
                {muted || volume <= 0 ? (
                  <VolumeX className="size-[1.15rem]" />
                ) : volume < 0.45 ? (
                  <Volume1 className="size-[1.15rem]" />
                ) : (
                  <Volume2 className="size-[1.15rem]" />
                )}
              </ControlButton>
              <div
                className={cn(
                  "flex w-0 items-center overflow-hidden opacity-0 transition-all duration-200 ease-out",
                  "group-hover/vol:w-24 group-hover/vol:opacity-100 group-focus-within/vol:w-24 group-focus-within/vol:opacity-100",
                )}
              >
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={muted ? 0 : Math.round(volume * 100)}
                  aria-label="Volume"
                  className="ml-1 h-1 w-[88px] cursor-pointer appearance-none rounded-full bg-white/30 accent-white [&::-webkit-slider-thumb]:size-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
                  onChange={(e) => {
                    setVolumeLevel(Number(e.target.value) / 100);
                  }}
                />
              </div>
            </div>

            <span className="ml-1 hidden items-center gap-1.5 text-[11px] font-medium tracking-wide text-white/80 uppercase sm:inline-flex">
              <span className="size-1.5 animate-pulse rounded-full bg-red-500" />
              Live
            </span>

            <div className="min-w-2 flex-1" />

            <div className="relative" data-quality-menu>
              <ControlButton
                label="Video quality"
                active={qualityIndex >= 0 || qualityOpen}
                disabled={!qualities.length && !hlsRef.current}
                onClick={() => {
                  bumpControls();
                  if (!qualities.length) {
                    toast.message("This stream has no selectable quality levels");
                    return;
                  }
                  setQualityOpen((v) => !v);
                }}
              >
                <Settings2 className="size-[1.15rem]" />
              </ControlButton>
              {qualityOpen && qualities.length > 0 && (
                <div className="absolute right-0 bottom-[calc(100%+8px)] z-40 min-w-[8.5rem] overflow-hidden rounded-lg border border-white/15 bg-[#0b1218]/95 py-1 shadow-xl backdrop-blur-md">
                  <p className="px-3 py-1.5 text-[10px] font-semibold tracking-wide text-white/50 uppercase">
                    Quality
                  </p>
                  <button
                    type="button"
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-white/90 hover:bg-white/10",
                      qualityIndex < 0 && "bg-teal-500/20 text-teal-100",
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      applyQuality(-1);
                    }}
                  >
                    <span>Auto{activeHeight ? ` · ${activeHeight}p` : ""}</span>
                    {qualityIndex < 0 && <Check className="size-3.5" />}
                  </button>
                  {qualities.map((q) => (
                    <button
                      key={`${q.index}-${q.label}`}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between px-3 py-1.5 text-left text-xs text-white/90 hover:bg-white/10",
                        qualityIndex === q.index && "bg-teal-500/20 text-teal-100",
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        applyQuality(q.index, q.height);
                      }}
                    >
                      <span>{q.label}</span>
                      {qualityIndex === q.index && <Check className="size-3.5" />}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <ControlButton
              label={`${captionModeLabel(captionMode)}. Click to cycle: Off → On → Auto EN`}
              active={captionMode !== "off"}
              onClick={toggleCaptions}
            >
              {captionMode === "off" ? (
                <CaptionsOff className="size-[1.15rem]" />
              ) : (
                <Captions className="size-[1.15rem]" />
              )}
            </ControlButton>

            {airPlayAvailable && (
              <ControlButton
                label="AirPlay / Apple TV"
                onClick={() => void handleAirPlay()}
              >
                <Airplay className="size-[1.15rem]" />
              </ControlButton>
            )}

            {castAvailable && (
              <ControlButton
                label={casting ? "Connected to Chromecast" : "Chromecast"}
                active={casting}
                onClick={() => void handleCast()}
              >
                <Cast className="size-[1.15rem]" />
              </ControlButton>
            )}

            {onPipToggle && (
              <ControlButton
                label="Picture in picture"
                active={pip}
                onClick={() => {
                  onPipToggle();
                  bumpControls();
                }}
              >
                <PictureInPicture2 className="size-[1.15rem]" />
              </ControlButton>
            )}

            <ControlButton
              label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              onClick={() => void toggleFullscreen()}
            >
              {isFullscreen ? (
                <Minimize className="size-[1.15rem]" />
              ) : (
                <Maximize className="size-[1.15rem]" />
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
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "inline-flex size-10 shrink-0 items-center justify-center rounded-full text-white transition",
        "hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        "disabled:cursor-not-allowed disabled:opacity-40",
        active && "bg-white/10 text-teal-200",
      )}
    >
      {children}
    </button>
  );
}
