/**
 * Import verified working free streams + keep healthy LK channels.
 * Run: npx tsx scripts/bootstrap-working-tv.ts
 */
import { prisma } from "../lib/prisma";
import { generateSlug } from "../lib/utils";
import { normalizeCategory, parseM3u } from "../lib/m3u";

const RELIABLE = [
  {
    name: "FluxTV Demo",
    streamUrl: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
    category: "General",
    country: "XX",
    countryName: "Demo",
    isLocal: false,
    externalId: "reliable:mux-demo",
  },
  {
    name: "Bloomberg Quicktake",
    streamUrl:
      "https://bloomberg-bloombergtv-1-eu.rakuten.wurl.tv/playlist.m3u8",
    category: "News",
    country: "US",
    countryName: "United States",
    isLocal: false,
    externalId: "reliable:bloomberg-qt",
  },
];

async function probe(url: string, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "*/*",
        Referer: new URL(url).origin + "/",
      },
      redirect: "follow",
    });
    const text = await res.text();
    return res.ok && text.includes("#EXTM3U") && !/EXT-X-KEY/i.test(text);
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

async function upsert(ch: {
  name: string;
  streamUrl: string;
  category: string;
  country: string;
  countryName: string;
  isLocal: boolean;
  externalId: string;
  logoUrl?: string | null;
  language?: string | null;
  sortOrder?: number;
}) {
  const existing = await prisma.channel.findUnique({
    where: { externalId: ch.externalId },
  });
  const data = {
    name: ch.name,
    streamUrl: ch.streamUrl,
    logoUrl: ch.logoUrl ?? null,
    country: ch.country,
    countryName: ch.countryName,
    language: ch.language ?? null,
    category: ch.category,
    isLocal: ch.isLocal,
    isBroken: false,
    isHidden: false,
    sortOrder: ch.sortOrder ?? 0,
  };

  if (existing) {
    await prisma.channel.update({ where: { id: existing.id }, data });
    return "updated";
  }

  let slug = generateSlug(ch.name) || `ch-${Date.now().toString(36)}`;
  if (await prisma.channel.findUnique({ where: { slug } })) {
    slug = `${slug}-${ch.externalId.slice(-6).replace(/[^a-z0-9]/gi, "")}`;
  }

  await prisma.channel.create({
    data: { ...data, slug, externalId: ch.externalId },
  });
  return "created";
}

async function main() {
  console.log("Bootstrapping working TV channels...");

  // Hide DRM / broken leftover LK channels from previous import
  await prisma.channel.updateMany({
    where: {
      OR: [
        { streamUrl: { contains: "drm", mode: "insensitive" } },
        { isBroken: true },
      ],
    },
    data: { isHidden: true },
  });

  // Re-check currently visible channels
  const visible = await prisma.channel.findMany({
    where: { isHidden: false },
  });
  for (const ch of visible) {
    const ok = await probe(ch.streamUrl);
    await prisma.channel.update({
      where: { id: ch.id },
      data: { isBroken: !ok, isHidden: !ok },
    });
    console.log(`${ok ? "KEEP" : "HIDE"} ${ch.name}`);
  }

  // Add reliable fallbacks
  for (const ch of RELIABLE) {
    const ok = await probe(ch.streamUrl);
    if (!ok) {
      console.log(`SKIP unreliable ${ch.name}`);
      continue;
    }
    const action = await upsert(ch);
    console.log(`${action.toUpperCase()} ${ch.name}`);
  }

  // Import a small set of working news channels from iptv-org
  console.log("Scanning iptv-org news playlist for live streams...");
  const newsRes = await fetch(
    "https://iptv-org.github.io/iptv/categories/news.m3u",
    { headers: { "User-Agent": "FluxTV/1.0" } },
  );
  if (newsRes.ok) {
    const parsed = parseM3u(await newsRes.text());
    let added = 0;
    for (const item of parsed) {
      if (added >= 12) break;
      if (!item.streamUrl.startsWith("https://")) continue;
      if (/drm/i.test(item.streamUrl)) continue;
      const ok = await probe(item.streamUrl, 7000);
      if (!ok) continue;
      await upsert({
        name: item.name,
        streamUrl: item.streamUrl,
        category: normalizeCategory(item.category) || "News",
        country: (item.country || "XX").toUpperCase(),
        countryName: item.country || "International",
        isLocal: false,
        externalId: item.externalId || `news:${generateSlug(item.name)}`,
        logoUrl: item.logoUrl,
        language: item.language,
        sortOrder: 100 + added,
      });
      console.log(`ADDED news ${item.name}`);
      added += 1;
    }
  }

  const live = await prisma.channel.count({
    where: { isHidden: false, isBroken: false },
  });
  console.log(`\nLive playable channels now: ${live}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
