"use client";

import { useEffect } from "react";

type MediaSessionOpts = {
  title?: string;
  artist?: string;
  artworkUrl?: string | null;
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  enabled?: boolean;
};

/** Lock-screen / Control Center / OS media controls + keep session alive for background play. */
export function useMediaSession({
  title,
  artist = "PSTV",
  artworkUrl,
  playing,
  onPlay,
  onPause,
  enabled = true,
}: MediaSessionOpts) {
  useEffect(() => {
    if (!enabled || typeof navigator === "undefined" || !("mediaSession" in navigator)) {
      return;
    }

    try {
      const artwork = artworkUrl
        ? [
            { src: artworkUrl, sizes: "96x96", type: "image/png" },
            { src: artworkUrl, sizes: "256x256", type: "image/png" },
            { src: artworkUrl, sizes: "512x512", type: "image/png" },
          ]
        : [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: title || "PSTV Live",
        artist,
        album: "Education-only live TV",
        artwork,
      });

      navigator.mediaSession.playbackState = playing ? "playing" : "paused";

      navigator.mediaSession.setActionHandler("play", () => onPlay());
      navigator.mediaSession.setActionHandler("pause", () => onPause());
      navigator.mediaSession.setActionHandler("stop", () => onPause());
    } catch {
      // Media Session unsupported or blocked
    }

    return () => {
      try {
        navigator.mediaSession.setActionHandler("play", null);
        navigator.mediaSession.setActionHandler("pause", null);
        navigator.mediaSession.setActionHandler("stop", null);
      } catch {
        // ignore
      }
    };
  }, [title, artist, artworkUrl, playing, onPlay, onPause, enabled]);
}
