/**
 * Import all Sri Lanka (local) channels from iptv-org.
 * Run: npm run tv:import-local
 */
import "dotenv/config";
import { prisma } from "../lib/prisma";
import { generateSlug } from "../lib/utils";
import {
  dedupeChannels,
  normalizeCategory,
  parseM3u,
  type ParsedM3uChannel,
} from "../lib/m3u";
import { countryPlaylistUrl } from "../lib/iptv-catalog";
import { languageForCountry } from "../lib/languages";

async function upsertLocal(items: ParsedM3uChannel[]) {
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

    const language =
      item.language || languageForCountry("LK") || "si";
    const category = normalizeCategory(item.category);
    const externalId =
      item.externalId?.trim() ||
      `lk:${generateSlug(name)}:${Buffer.from(streamUrl).toString("base64url").slice(0, 16)}`;

    const existingId = byExternal.get(externalId) || byUrl.get(streamUrl);
    if (existingId) {
      await prisma.channel.update({
        where: { id: existingId },
        data: {
          name,
          streamUrl,
          logoUrl: item.logoUrl || undefined,
          country: "LK",
          countryName: "Sri Lanka",
          language: language || undefined,
          category,
          isLocal: true,
          isHidden: false,
          isPremium: false,
          externalId,
        },
      });
      updated += 1;
      continue;
    }

    let slug = generateSlug(name) || `lk-${created}`;
    if (usedSlugs.has(slug)) {
      slug = `${slug}-${externalId.slice(-8).replace(/[^a-z0-9]/gi, "").toLowerCase() || created}`;
    }
    usedSlugs.add(slug);

    toCreate.push({
      name,
      slug,
      streamUrl,
      logoUrl: item.logoUrl || null,
      country: "LK",
      countryName: "Sri Lanka",
      language,
      category,
      isLocal: true,
      isPremium: false,
      externalId,
      sortOrder: sortOrder++,
      isHidden: false,
      isBroken: false,
    });
    created += 1;
  }

  for (let i = 0; i < toCreate.length; i += 100) {
    await prisma.channel.createMany({
      data: toCreate.slice(i, i + 100) as never[],
      skipDuplicates: true,
    });
  }

  await prisma.channel.updateMany({
    where: { country: "LK" },
    data: {
      isLocal: true,
      countryName: "Sri Lanka",
      isHidden: false,
      isPremium: false,
    },
  });

  return { created, updated, total: deduped.length };
}

async function main() {
  const url = countryPlaylistUrl("lk");
  console.log(`Fetching ${url} …`);
  const res = await fetch(url, {
    headers: { "User-Agent": "FluxTV-Import/1.0" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Failed to download LK playlist (${res.status})`);
  }

  const parsed = parseM3u(await res.text()).map((ch) => ({
    ...ch,
    country: "LK",
    countryName: "Sri Lanka",
  }));

  console.log(`Parsed ${parsed.length} LK channels. Upserting…`);
  const result = await upsertLocal(parsed);
  const localCount = await prisma.channel.count({
    where: { isLocal: true, isHidden: false },
  });

  console.log(
    `Done. playlist=${result.total} created=${result.created} updated=${result.updated} visibleLocal=${localCount}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
