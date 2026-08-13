import { gunzipSync } from "zlib";
import { mkdir, readFile, writeFile, stat } from "fs/promises";
import path from "path";

export type ParsedProgramme = {
  channelId: string;
  title: string;
  description: string | null;
  startsAt: Date;
  endsAt: Date;
};

const CACHE_DIR = path.join(process.cwd(), ".cache", "epg");
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/** Normalize channel names for fuzzy EPG matching. */
export function normalizeChannelKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^lk\s*-\s*/i, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(hd|sd|fhd|uhd|4k|tv|channel|network)\b/gi, " ")
    .replace(/[^a-z0-9]+/g, "");
}

/** Strip iptv-org feed suffix: HiruTV.lk@SD → hirutv.lk */
export function xmltvIdFromExternal(externalId?: string | null): string | null {
  if (!externalId) return null;
  const base = externalId.split("@")[0]?.trim();
  return base ? base.toLowerCase() : null;
}

/** Parse XMLTV datetime like 20260813140000 +0000 or 20260813140000 +0530 */
export function parseXmltvDate(raw: string): Date | null {
  const m = raw
    .trim()
    .match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, tz] = m;
  const iso = `${y}-${mo}-${d}T${h}:${mi}:${s}${
    tz ? `${tz.slice(0, 3)}:${tz.slice(3)}` : "Z"
  }`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function readCache(file: string): Promise<string | null> {
  try {
    const full = path.join(CACHE_DIR, file);
    const info = await stat(full);
    if (Date.now() - info.mtimeMs > CACHE_TTL_MS) return null;
    return await readFile(full, "utf8");
  } catch {
    return null;
  }
}

async function writeCache(file: string, body: string) {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, file), body, "utf8");
  } catch {
    // cache is best-effort
  }
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FluxTV-EPG/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (url.endsWith(".gz") || res.headers.get("content-type")?.includes("gzip")) {
      try {
        return gunzipSync(buf).toString("utf8");
      } catch {
        return buf.toString("utf8");
      }
    }
    return buf.toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Fetch Hiru TV's official daily lineup (Asia/Colombo wall times).
 * https://www.hirutv.lk/json/lineup.php
 */
export async function fetchHiruTvSchedule(day = new Date()): Promise<ParsedProgramme[]> {
  const text = await fetchText("https://www.hirutv.lk/json/lineup.php");
  if (!text) return [];

  let json: Record<string, Array<{ name?: string; time?: string }>>;
  try {
    json = JSON.parse(text);
  } catch {
    return [];
  }

  const weekday = day.toLocaleDateString("en-US", {
    weekday: "long",
    timeZone: "Asia/Colombo",
  });
  const rows = json[weekday] || [];
  if (!rows.length) return [];

  const dayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Colombo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(day);
  const y = dayParts.find((p) => p.type === "year")?.value;
  const m = dayParts.find((p) => p.type === "month")?.value;
  const d = dayParts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return [];

  const starts: { title: string; at: Date }[] = [];
  for (const row of rows) {
    const title = (row.name || "").trim();
    const time = (row.time || "").trim();
    if (!title || !time) continue;
    const tm = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
    if (!tm) continue;
    let hour = Number(tm[1]) % 12;
    if (/pm/i.test(tm[3])) hour += 12;
    const minute = Number(tm[2]);
    // Asia/Colombo is fixed UTC+5:30
    const at = new Date(
      Date.UTC(Number(y), Number(m) - 1, Number(d), hour, minute) -
        5.5 * 60 * 60 * 1000,
    );
    starts.push({ title, at });
  }

  starts.sort((a, b) => a.at.getTime() - b.at.getTime());
  const out: ParsedProgramme[] = [];
  for (let i = 0; i < starts.length; i++) {
    const cur = starts[i];
    const next = starts[i + 1];
    const endsAt = next
      ? next.at
      : new Date(cur.at.getTime() + 60 * 60 * 1000);
    if (endsAt <= cur.at) continue;
    out.push({
      channelId: "hirutv.lk",
      title: cur.title,
      description: "Hiru TV official schedule",
      startsAt: cur.at,
      endsAt,
    });
  }
  return out;
}

type XmlChannel = { id: string; names: string[] };

/**
 * Parse a lightweight subset of XMLTV into channel map + programmes.
 * Avoids full DOM for multi‑MB files.
 */
export function parseXmltv(xml: string): {
  channels: XmlChannel[];
  programmes: ParsedProgramme[];
} {
  const channels: XmlChannel[] = [];
  const channelRe =
    /<channel\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/gi;
  let cm: RegExpExecArray | null;
  while ((cm = channelRe.exec(xml))) {
    const id = cm[1];
    const names = Array.from(
      cm[2].matchAll(/<display-name[^>]*>([^<]*)<\/display-name>/gi),
    ).map((x) => x[1].trim()).filter(Boolean);
    channels.push({ id, names: names.length ? names : [id] });
  }

  const programmes: ParsedProgramme[] = [];
  const progRe =
    /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/gi;
  let pm: RegExpExecArray | null;
  while ((pm = progRe.exec(xml))) {
    const attrs = pm[1];
    const body = pm[2];
    const start = attrs.match(/\bstart="([^"]+)"/i)?.[1];
    const stop = attrs.match(/\bstop="([^"]+)"/i)?.[1];
    const channel = attrs.match(/\bchannel="([^"]+)"/i)?.[1];
    if (!start || !stop || !channel) continue;
    const title =
      body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";
    if (!title || /^no data$/i.test(title)) continue;
    const description =
      body.match(/<desc[^>]*>([^<]*)<\/desc>/i)?.[1]?.trim() || null;
    const startsAt = parseXmltvDate(start);
    const endsAt = parseXmltvDate(stop);
    if (!startsAt || !endsAt || endsAt <= startsAt) continue;
    programmes.push({
      channelId: channel,
      title,
      description: description && !/^https?:\/\//i.test(description) ? description : null,
      startsAt,
      endsAt,
    });
  }

  return { channels, programmes };
}

/** Download (and cache) epg.pw country guide XML text. */
export async function loadEpgPwCountryXml(
  countryCode: string,
): Promise<string | null> {
  const cc = countryCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return null;
  const fileCc = cc === "UK" ? "GB" : cc;
  const cacheFile = `epg-pw-${fileCc}.xml`;
  let xml = await readCache(cacheFile);
  if (!xml) {
    xml = await fetchText(`https://epg.pw/xmltv/epg_${fileCc}.xml`);
    if (!xml) return null;
    await writeCache(cacheFile, xml);
  }
  return xml;
}

/** @deprecated prefer loadEpgPwCountryXml + extractProgrammesForChannelName */
export async function loadEpgPwCountry(countryCode: string): Promise<{
  channels: XmlChannel[];
  programmes: ParsedProgramme[];
} | null> {
  const xml = await loadEpgPwCountryXml(countryCode);
  if (!xml) return null;
  return parseXmltv(xml);
}

/** Find programmes in an XMLTV guide matching a FluxTV channel name. */
export function matchProgrammesByName(
  guide: { channels: XmlChannel[]; programmes: ParsedProgramme[] },
  channelName: string,
): ParsedProgramme[] {
  const key = normalizeChannelKey(channelName);
  if (!key || key.length < 3) return [];

  let bestId: string | null = null;
  let bestScore = 0;
  for (const ch of guide.channels) {
    for (const name of ch.names) {
      const n = normalizeChannelKey(name);
      if (!n) continue;
      let score = 0;
      if (n === key) score = 100;
      else if (n.includes(key) || key.includes(n)) score = 70;
      if (score > bestScore) {
        bestScore = score;
        bestId = ch.id;
      }
    }
  }
  if (!bestId || bestScore < 70) return [];
  return guide.programmes.filter((p) => p.channelId === bestId);
}

/**
 * Faster path for huge XMLTV files: resolve channel id by name, then
 * extract only that channel's programmes (skip building a full programme array).
 */
export function extractProgrammesForChannelName(
  xml: string,
  channelName: string,
): ParsedProgramme[] {
  const key = normalizeChannelKey(channelName);
  if (!key || key.length < 3) return [];

  let bestId: string | null = null;
  let bestScore = 0;
  const channelRe =
    /<channel\s+id="([^"]+)"[^>]*>([\s\S]*?)<\/channel>/gi;
  let cm: RegExpExecArray | null;
  while ((cm = channelRe.exec(xml))) {
    const id = cm[1];
    const names = Array.from(
      cm[2].matchAll(/<display-name[^>]*>([^<]*)<\/display-name>/gi),
    ).map((x) => x[1].trim());
    for (const name of names.length ? names : [id]) {
      const n = normalizeChannelKey(name);
      if (!n) continue;
      let score = 0;
      if (n === key) score = 100;
      else if (n.includes(key) || key.includes(n)) score = 70;
      if (score > bestScore) {
        bestScore = score;
        bestId = id;
      }
    }
    if (bestScore === 100) break;
  }
  if (!bestId || bestScore < 70) return [];

  const programmes: ParsedProgramme[] = [];
  const escaped = bestId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const progRe = new RegExp(
    `<programme\\s+([^>]*channel="${escaped}"[^>]*)>([\\s\\S]*?)<\\/programme>`,
    "gi",
  );
  let pm: RegExpExecArray | null;
  while ((pm = progRe.exec(xml))) {
    const attrs = pm[1];
    const body = pm[2];
    const start = attrs.match(/\bstart="([^"]+)"/i)?.[1];
    const stop = attrs.match(/\bstop="([^"]+)"/i)?.[1];
    if (!start || !stop) continue;
    const title =
      body.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() || "";
    if (!title || /^no data$/i.test(title)) continue;
    const description =
      body.match(/<desc[^>]*>([^<]*)<\/desc>/i)?.[1]?.trim() || null;
    const startsAt = parseXmltvDate(start);
    const endsAt = parseXmltvDate(stop);
    if (!startsAt || !endsAt || endsAt <= startsAt) continue;
    programmes.push({
      channelId: bestId,
      title,
      description:
        description && !/^https?:\/\//i.test(description) ? description : null,
      startsAt,
      endsAt,
    });
  }
  return programmes;
}

export function isHiruChannel(channel: {
  name: string;
  externalId?: string | null;
}): boolean {
  const ext = (channel.externalId || "").toLowerCase();
  const name = channel.name.toLowerCase();
  return ext.startsWith("hirutv.lk") || name === "hiru tv" || name.includes("hiru tv");
}
