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
  if (url.startsWith("/api/proxy")) return url;
  try {
    const origin = new URL(url).origin + "/";
    return `/api/proxy?url=${encodeURIComponent(url)}&referer=${encodeURIComponent(origin)}`;
  } catch {
    return `/api/proxy?url=${encodeURIComponent(url)}`;
  }
}
