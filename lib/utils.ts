import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function proxiedStreamUrl(url: string): string {
  if (!url) return url;
  // Local app assets (demo video, etc.) — never send through the CORS proxy.
  if (url.startsWith("/") && !url.startsWith("//") && !url.startsWith("/api/proxy")) {
    return url;
  }
  if (url.startsWith("/api/proxy")) return url;
  try {
    const origin = new URL(url).origin + "/";
    return `/api/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(origin)}`;
  } catch {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
}

/** Progressive files (mp4/webm) use the native video element — not HLS.js. */
export function isProgressiveMediaUrl(url: string): boolean {
  if (!url) return false;
  try {
    const path = url.startsWith("/")
      ? url.split("?")[0]
      : new URL(url).pathname;
    return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(path);
  } catch {
    return /\.(mp4|webm|ogg|mov)(\?|$)/i.test(url);
  }
}

export const PS_DEMO_CHANNEL = {
  name: "PS Demo TV",
  slug: "ps-demo-tv",
  externalId: "pstv:ps-demo-tv",
  streamUrl: "/videos/ps-demo-tv.mp4",
} as const;
