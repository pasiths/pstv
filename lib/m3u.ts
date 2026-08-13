export type ParsedM3uChannel = {
  name: string;
  streamUrl: string;
  logoUrl?: string | null;
  externalId?: string | null;
  category?: string | null;
  language?: string | null;
  country?: string | null;
  countryName?: string | null;
};

function attr(line: string, key: string): string | null {
  const re = new RegExp(`${key}="([^"]*)"`, "i");
  const match = line.match(re);
  return match?.[1]?.trim() || null;
}

/** Extract ISO country from iptv-org tvg-id like "HiruTV.lk@SD". */
export function countryFromTvgId(tvgId?: string | null): string | null {
  if (!tvgId) return null;
  const match = tvgId.match(/\.([a-z]{2})(?:@|$)/i);
  return match?.[1]?.toUpperCase() ?? null;
}

/** Parse extended M3U / M3U8 playlist text into channel entries. */
export function parseM3u(content: string): ParsedM3uChannel[] {
  const lines = content.split(/\r?\n/);
  const channels: ParsedM3uChannel[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line.startsWith("#EXTINF:")) continue;

    const name = line.includes(",")
      ? line.slice(line.lastIndexOf(",") + 1).trim()
      : "Unknown";
    const logoUrl = attr(line, "tvg-logo");
    const externalId = attr(line, "tvg-id");
    const group = attr(line, "group-title");
    const category = group?.split(";")[0]?.trim() || "General";
    const language = attr(line, "tvg-language");
    const countryAttr = attr(line, "tvg-country");
    const country =
      countryAttr?.toUpperCase() || countryFromTvgId(externalId) || null;

    let streamUrl = "";
    for (let j = i + 1; j < lines.length; j++) {
      const next = lines[j].trim();
      if (!next || next.startsWith("#")) continue;
      streamUrl = next;
      i = j;
      break;
    }

    if (!streamUrl) continue;
    if (!/^https?:\/\//i.test(streamUrl)) continue;

    // Skip obvious DRM / adult markers in URL or group when possible
    if (/\/drm|sample-aes|widevine/i.test(streamUrl)) continue;

    channels.push({
      name:
        name
          .replace(/\s*\(\d+p\)\s*/gi, " ")
          .replace(/\s*\[.*?\]\s*/g, " ")
          .trim() || name,
      streamUrl,
      logoUrl,
      externalId,
      category: category === "Undefined" ? "General" : category,
      language,
      country,
    });
  }

  return channels;
}

export function normalizeCategory(raw?: string | null): string {
  if (!raw) return "General";
  const value = raw.toLowerCase();
  if (value.includes("news")) return "News";
  if (value.includes("sport")) return "Sports";
  if (value.includes("kid") || value.includes("children")) return "Kids";
  if (value.includes("movie") || value.includes("cinema")) return "Movies";
  if (value.includes("music")) return "Music";
  if (value.includes("enter") || value.includes("series")) return "Entertainment";
  if (value.includes("doc")) return "Documentary";
  if (value.includes("relig")) return "Religious";
  if (value.includes("educ")) return "Education";
  if (value.includes("cook")) return "Lifestyle";
  if (value.includes("travel") || value.includes("outdoor")) return "Lifestyle";
  return raw.split(";")[0].trim() || "General";
}

export function dedupeChannels(items: ParsedM3uChannel[]): ParsedM3uChannel[] {
  const byKey = new Map<string, ParsedM3uChannel>();
  for (const item of items) {
    const key = (item.externalId || item.streamUrl).toLowerCase();
    if (!byKey.has(key)) byKey.set(key, item);
  }
  return Array.from(byKey.values());
}
