/**
 * Stream health probing + alternate URL repair from iptv-org public streams.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

export type ProbeResult = {
  ok: boolean;
  status: number;
  isPlaylist: boolean;
  hasDrm: boolean;
  error?: string;
};

type IptvStream = {
  channel?: string | null;
  url?: string | null;
  quality?: string | null;
};

let streamsCache: IptvStream[] | null = null;
let streamsCacheAt = 0;

export async function probeStreamUrl(
  url: string,
  timeoutMs = 8000,
): Promise<ProbeResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      redirect: "follow",
      headers: {
        "User-Agent": UA,
        Accept: "*/*",
        Range: "bytes=0-2048",
        Referer: safeOrigin(url),
      },
    });
    const text = await res.text();
    const isPlaylist = text.includes("#EXTM3U") || /\.m3u8(\?|$)/i.test(url);
    const hasDrm =
      /EXT-X-KEY|widevine|fairplay|playready/i.test(text) || /drm/i.test(url);
    const ok = (res.ok || res.status === 206) && !hasDrm && (isPlaylist || res.ok);
    return {
      ok,
      status: res.status,
      isPlaylist,
      hasDrm,
    };
  } catch (e) {
    return {
      ok: false,
      status: 0,
      isPlaylist: false,
      hasDrm: /drm/i.test(url),
      error: e instanceof Error ? e.message : "fail",
    };
  } finally {
    clearTimeout(timer);
  }
}

function safeOrigin(url: string) {
  try {
    return new URL(url).origin + "/";
  } catch {
    return "https://iptv-org.github.io/";
  }
}

export async function loadIptvOrgStreams(): Promise<IptvStream[]> {
  const freshMs = 1000 * 60 * 60; // 1h
  if (streamsCache && Date.now() - streamsCacheAt < freshMs) {
    return streamsCache;
  }
  const res = await fetch("https://iptv-org.github.io/api/streams.json", {
    headers: { "User-Agent": UA, Accept: "application/json" },
  });
  if (!res.ok) return streamsCache ?? [];
  const data = (await res.json()) as IptvStream[];
  streamsCache = Array.isArray(data) ? data : [];
  streamsCacheAt = Date.now();
  return streamsCache;
}

/** Candidate alternate URLs for a channel (same tvg-id / external id first). */
export async function findAlternateStreamUrls(input: {
  externalId?: string | null;
  currentUrl: string;
  limit?: number;
}): Promise<string[]> {
  const streams = await loadIptvOrgStreams();
  const limit = input.limit ?? 8;
  const current = input.currentUrl.trim();
  const ext = input.externalId?.trim();

  const byId = ext
    ? streams.filter((s) => s.channel && s.channel === ext && s.url && s.url !== current)
    : [];

  const urls = [
    ...byId.map((s) => s.url!).filter(Boolean),
  ];

  const unique = [...new Set(urls)].slice(0, limit);
  return unique;
}

/**
 * Probe current URL; if dead, try alternates and return a working URL when found.
 */
export async function repairStreamUrl(input: {
  streamUrl: string;
  externalId?: string | null;
}): Promise<{
  working: boolean;
  url: string;
  repaired: boolean;
}> {
  const current = await probeStreamUrl(input.streamUrl);
  if (current.ok) {
    return { working: true, url: input.streamUrl, repaired: false };
  }

  const alts = await findAlternateStreamUrls({
    externalId: input.externalId,
    currentUrl: input.streamUrl,
  });

  for (const alt of alts) {
    const probe = await probeStreamUrl(alt);
    if (probe.ok) {
      return { working: true, url: alt, repaired: true };
    }
  }

  return { working: false, url: input.streamUrl, repaired: false };
}
