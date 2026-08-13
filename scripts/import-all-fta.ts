/**
 * Import all local (LK) + free-to-air channels from iptv-org.
 * Run: npm run tv:import-all
 */
import { prisma } from "../lib/prisma";
import { generateSlug } from "../lib/utils";
import {
  dedupeChannels,
  normalizeCategory,
  parseM3u,
  type ParsedM3uChannel,
} from "../lib/m3u";
import {
  COUNTRY_NAME_BY_CODE,
  FTA_CATEGORIES,
  FTA_COUNTRIES,
  categoryPlaylistUrl,
  countryPlaylistUrl,
} from "../lib/iptv-catalog";

async function fetchPlaylist(url: string) {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "FluxTV-Import/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function upsertAll(items: ParsedM3uChannel[]) {
  const deduped = dedupeChannels(items);
  const existing = await prisma.channel.findMany({
    select: { id: true, externalId: true, streamUrl: true, slug: true },
  });
  const byExternal = new Map(
    existing.filter((e) => e.externalId).map((e) => [e.externalId!, e.id]),
  );
  const byUrl = new Map(existing.map((e) => [e.streamUrl, e.id]));
  const usedSlugs = new Set(existing.map((e) => e.slug));

  let created = 0;
  let updated = 0;
  const toCreate: Array<Record<string, unknown>> = [];
  let sortOrder = existing.length;

  for (const item of deduped) {
    const name = item.name.trim();
    const streamUrl = item.streamUrl.trim();
    if (!name || !streamUrl) continue;

    const country = (item.country || "XX").toUpperCase();
    const countryName =
      item.countryName ||
      COUNTRY_NAME_BY_CODE[country] ||
      (country === "LK" ? "Sri Lanka" : country);
    const isLocal = country === "LK";
    const category = normalizeCategory(item.category);
    const externalId =
      item.externalId?.trim() ||
      `m3u:${generateSlug(name)}:${Buffer.from(streamUrl).toString("base64url").slice(0, 16)}`;

    const existingId = byExternal.get(externalId) || byUrl.get(streamUrl);
    if (existingId) {
      await prisma.channel.update({
        where: { id: existingId },
        data: {
          name,
          streamUrl,
          logoUrl: item.logoUrl || undefined,
          country,
          countryName,
          language: item.language || undefined,
          category,
          isLocal,
          isHidden: false,
          externalId,
        },
      });
      updated += 1;
      continue;
    }

    let slug = generateSlug(name) || `ch-${created}`;
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${externalId.slice(-8).replace(/[^a-z0-9]/gi, "").toLowerCase() || created}`;
    }
    usedSlugs.add(slug);

    toCreate.push({
      name,
      slug,
      streamUrl,
      logoUrl: item.logoUrl || null,
      country,
      countryName,
      language: item.language || null,
      category,
      isLocal,
      externalId,
      sortOrder: sortOrder++,
      isHidden: false,
      isBroken: false,
    });
    created += 1;
  }

  for (let i = 0; i < toCreate.length; i += 200) {
    await prisma.channel.createMany({
      data: toCreate.slice(i, i + 200) as never[],
      skipDuplicates: true,
    });
    process.stdout.write(`\rCreated chunk ${Math.min(i + 200, toCreate.length)}/${toCreate.length}`);
  }
  if (toCreate.length) process.stdout.write("\n");

  await prisma.channel.updateMany({
    where: { country: "LK" },
    data: { isLocal: true, countryName: "Sri Lanka", isHidden: false },
  });

  return { created, updated, total: deduped.length };
}

async function main() {
  console.log("📡 Importing local + free-to-air channels from iptv-org...\n");

  const sources = [
    ...FTA_COUNTRIES.map((c) => ({
      label: c.name,
      url: countryPlaylistUrl(c.code),
      country: c.code.toUpperCase(),
      countryName: c.name,
    })),
    ...FTA_CATEGORIES.map((category) => ({
      label: `category:${category}`,
      url: categoryPlaylistUrl(category),
      country: "XX",
      countryName: "International",
    })),
  ];

  const collected: ParsedM3uChannel[] = [];
  let okSources = 0;

  for (let i = 0; i < sources.length; i += 8) {
    const batch = sources.slice(i, i + 8);
    const texts = await Promise.all(batch.map((s) => fetchPlaylist(s.url)));
    texts.forEach((text, idx) => {
      const src = batch[idx];
      if (!text) {
        console.log(`  skip ${src.label}`);
        return;
      }
      okSources += 1;
      const parsed = parseM3u(text).map((ch) => {
        const country = (ch.country || src.country).toUpperCase();
        return {
          ...ch,
          country,
          countryName:
            country === "LK"
              ? "Sri Lanka"
              : COUNTRY_NAME_BY_CODE[country] || src.countryName,
        };
      });
      console.log(`  +${parsed.length} from ${src.label}`);
      collected.push(...parsed);
    });
  }

  console.log(`\nSources OK: ${okSources}/${sources.length}`);
  console.log(`Raw entries: ${collected.length}`);
  console.log("Upserting into database...");

  const result = await upsertAll(collected);
  const [local, total, visible] = await Promise.all([
    prisma.channel.count({ where: { isLocal: true, isHidden: false } }),
    prisma.channel.count(),
    prisma.channel.count({ where: { isHidden: false } }),
  ]);

  console.log("\n✅ Import complete");
  console.log(`   upserted new: ${result.created}`);
  console.log(`   updated: ${result.updated}`);
  console.log(`   unique parsed: ${result.total}`);
  console.log(`   local LK visible: ${local}`);
  console.log(`   total visible: ${visible}`);
  console.log(`   total in DB: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
