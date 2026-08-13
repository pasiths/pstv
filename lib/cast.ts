"use client";

declare global {
  interface Window {
    __onGCastApiAvailable?: (isAvailable: boolean) => void;
    cast?: {
      framework?: {
        CastContext: {
          getInstance: () => CastContext;
        };
        CastContextEventType: {
          CAST_STATE_CHANGED: string;
          SESSION_STATE_CHANGED: string;
        };
        CastState: {
          NO_DEVICES_AVAILABLE: string;
          NOT_CONNECTED: string;
          CONNECTING: string;
          CONNECTED: string;
        };
        SessionState: {
          SESSION_STARTED: string;
          SESSION_RESUMED: string;
          SESSION_ENDED: string;
        };
        CastOptions?: unknown;
      };
    };
    chrome?: {
      cast?: {
        media?: {
          DEFAULT_MEDIA_RECEIVER_APP_ID: string;
          MediaInfo: new (url: string, type: string) => MediaInfo;
          LoadRequest: new (media: MediaInfo) => LoadRequest;
          StreamType: { LIVE: string; BUFFERED: string };
          MetadataType: { GENERIC: number };
          GenericMediaMetadata: new () => GenericMediaMetadata;
        };
        AutoJoinPolicy?: { ORIGIN_SCOPED: string };
      };
    };
  }
}

type CastContext = {
  setOptions: (options: Record<string, unknown>) => void;
  getCastState: () => string;
  getCurrentSession: () => CastSession | null;
  addEventListener: (type: string, listener: (e: { castState?: string }) => void) => void;
  removeEventListener: (type: string, listener: (e: { castState?: string }) => void) => void;
  requestSession: () => Promise<void>;
};

type CastSession = {
  loadMedia: (request: LoadRequest) => Promise<unknown>;
  getCastDevice?: () => { friendlyName?: string };
  endSession?: (stopCasting: boolean) => void;
};

type MediaInfo = {
  metadata?: GenericMediaMetadata;
  streamType?: string;
  contentType?: string;
};

type LoadRequest = {
  autoplay?: boolean;
  currentTime?: number;
};

type GenericMediaMetadata = {
  title?: string;
  subtitle?: string;
  images?: Array<{ url: string }>;
  metadataType?: number;
};

const DEFAULT_RECEIVER = "CC1AD845";

export function getCastAppId() {
  return process.env.NEXT_PUBLIC_CAST_APP_ID || DEFAULT_RECEIVER;
}

export function loadCastSdk(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);

  if (window.cast?.framework) return Promise.resolve(true);

  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-fluxtv-cast="1"]',
    );
    if (existing) {
      window.__onGCastApiAvailable = (available) => resolve(Boolean(available));
      return;
    }

    window.__onGCastApiAvailable = (available) => {
      resolve(Boolean(available));
    };

    const script = document.createElement("script");
    script.src =
      "https://www.gstatic.com/cv/js/sender/v1/cast_sender.js?loadCastFramework=1";
    script.async = true;
    script.dataset.fluxtvCast = "1";
    script.onerror = () => resolve(false);
    document.head.appendChild(script);

    // Fallback if callback never fires
    setTimeout(() => {
      resolve(Boolean(window.cast?.framework));
    }, 8000);
  });
}

export async function initCastContext(): Promise<CastContext | null> {
  const ok = await loadCastSdk();
  if (!ok || !window.cast?.framework || !window.chrome?.cast?.media) {
    return null;
  }

  const context = window.cast.framework.CastContext.getInstance();
  context.setOptions({
    receiverApplicationId:
      window.chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID || getCastAppId(),
    autoJoinPolicy: window.chrome.cast.AutoJoinPolicy?.ORIGIN_SCOPED,
  });
  return context;
}

export async function castHlsMedia(input: {
  contentUrl: string;
  title?: string;
  subtitle?: string;
  poster?: string | null;
}): Promise<{ success: boolean; error?: string; deviceName?: string }> {
  try {
    const context = await initCastContext();
    if (!context || !window.chrome?.cast?.media || !window.cast?.framework) {
      return {
        success: false,
        error: "Chromecast is not available in this browser.",
      };
    }

    // Chromecast cannot reach localhost proxy URLs — cast the original stream.
    const absoluteUrl = toAbsoluteMediaUrl(input.contentUrl);
    if (!absoluteUrl.startsWith("http")) {
      return { success: false, error: "Invalid stream URL for casting." };
    }

    const state = context.getCastState();
    if (state !== window.cast.framework.CastState.CONNECTED) {
      await context.requestSession();
    }

    const session = context.getCurrentSession();
    if (!session) {
      return { success: false, error: "No Chromecast session started." };
    }

    const mediaInfo = new window.chrome.cast.media.MediaInfo(
      absoluteUrl,
      "application/x-mpegurl",
    );
    mediaInfo.streamType = window.chrome.cast.media.StreamType.LIVE;
    const metadata = new window.chrome.cast.media.GenericMediaMetadata();
    metadata.metadataType = window.chrome.cast.media.MetadataType.GENERIC;
    metadata.title = input.title || "FluxTV";
    metadata.subtitle = input.subtitle || "Live TV";
    if (input.poster) {
      metadata.images = [{ url: input.poster }];
    }
    mediaInfo.metadata = metadata;

    const request = new window.chrome.cast.media.LoadRequest(mediaInfo);
    request.autoplay = true;
    await session.loadMedia(request);

    return {
      success: true,
      deviceName: session.getCastDevice?.()?.friendlyName,
    };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Failed to cast to Chromecast.";
    return { success: false, error: message };
  }
}

function toAbsoluteMediaUrl(url: string) {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  if (typeof window === "undefined") return url;
  return new URL(url, window.location.origin).toString();
}

export function supportsAirPlay(video: HTMLVideoElement | null) {
  if (!video) return false;
  return typeof (video as HTMLVideoElement & {
    webkitShowPlaybackTargetPicker?: () => void;
  }).webkitShowPlaybackTargetPicker === "function";
}

export function promptAirPlay(video: HTMLVideoElement | null) {
  const v = video as HTMLVideoElement & {
    webkitShowPlaybackTargetPicker?: () => void;
  };
  v?.webkitShowPlaybackTargetPicker?.();
}

export async function promptRemotePlayback(video: HTMLVideoElement | null) {
  if (!video) return { success: false, error: "No video element." };
  const remote = (
    video as HTMLVideoElement & {
      remote?: {
        prompt: () => Promise<void>;
        state?: string;
      };
    }
  ).remote;

  if (!remote?.prompt) {
    return {
      success: false,
      error: "Remote playback is not supported here.",
    };
  }

  try {
    await remote.prompt();
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Remote playback cancelled.",
    };
  }
}
