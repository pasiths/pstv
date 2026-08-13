"use client";

import { PictureInPicture2, Pause, Play, Radio, X } from "lucide-react";
import { cn } from "@/lib/utils";

type NowPlayingPopupProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  logoUrl?: string | null;
  playing: boolean;
  onPlayPause: () => void;
  onOpenPip?: () => void;
  onClose: () => void;
  onFocusPlayer: () => void;
};

/** Floating “now playing” media popup when the main player is off-screen. */
export function NowPlayingPopup({
  open,
  title,
  subtitle,
  logoUrl,
  playing,
  onPlayPause,
  onOpenPip,
  onClose,
  onFocusPlayer,
}: NowPlayingPopupProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed z-[60] max-w-[min(100vw-1.5rem,22rem)]",
        "bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 sm:right-5",
        "animate-in fade-in slide-in-from-bottom-3 duration-300",
      )}
      role="dialog"
      aria-label="Now playing"
    >
      <div className="overflow-hidden rounded-2xl border border-white/15 bg-[#0b1218]/95 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.85)] backdrop-blur-xl">
        <button
          type="button"
          onClick={onFocusPlayer}
          className="flex w-full items-center gap-3 px-3 pt-3 text-left"
        >
          <div className="relative size-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-black">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="" className="size-full object-cover" />
            ) : (
              <div className="flex size-full items-center justify-center text-teal-300">
                <Radio className="size-5" />
              </div>
            )}
            {playing && (
              <span className="absolute bottom-1 left-1 size-1.5 animate-pulse rounded-full bg-red-500" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium tracking-[0.16em] text-teal-400 uppercase">
              Now playing
            </p>
            <p className="truncate text-sm font-semibold text-white">{title}</p>
            {subtitle ? (
              <p className="truncate text-[11px] text-white/55">{subtitle}</p>
            ) : null}
          </div>
        </button>

        <div className="mt-2 flex items-center gap-1 border-t border-white/10 px-2 py-2">
          <button
            type="button"
            aria-label={playing ? "Pause" : "Play"}
            onClick={onPlayPause}
            className="inline-flex size-10 items-center justify-center rounded-full bg-teal-600 text-white hover:bg-teal-500 active:scale-95"
          >
            {playing ? (
              <Pause className="size-4" />
            ) : (
              <Play className="size-4 fill-current pl-0.5" />
            )}
          </button>

          {onOpenPip ? (
            <button
              type="button"
              aria-label="Picture in picture"
              onClick={onOpenPip}
              className="inline-flex size-10 items-center justify-center rounded-full text-white/85 hover:bg-white/10"
            >
              <PictureInPicture2 className="size-4" />
            </button>
          ) : null}

          <button
            type="button"
            onClick={onFocusPlayer}
            className="ml-1 flex-1 rounded-full px-3 py-2 text-left text-xs font-medium text-white/80 hover:bg-white/10"
          >
            Back to player
          </button>

          <button
            type="button"
            aria-label="Dismiss"
            onClick={onClose}
            className="inline-flex size-9 items-center justify-center rounded-full text-white/60 hover:bg-white/10 hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
