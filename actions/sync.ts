"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { generateSlug } from "@/lib/utils";
import {
  dedupeChannels,
  normalizeCategory,
  parseM3u,
  type ParsedM3uChannel,
} from "@/lib/m3u";
import {
  getCountryLongName,
  FTA_CATEGORIES,
  FTA_COUNTRIES,
  categoryPlaylistUrl,
  countryPlaylistUrl,
} from "@/lib/iptv-catalog";
import { languageForCountry } from "@/lib/languages";
import { revalidatePath } from "next/cache";

export type ImportResult = {
  success: boolean;
  error?: string;
  created?: number;
  updated?: number;
  skipped?: number;
  total?: number;
  sources?: number;
};

async function requireImportPermission() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "channels-create", "channels-index")) {
    throw new Error("Unauthorized");
  }
  return user;
}

function revalidateCatalog() {
  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/channels");
  revalidatePath("/dashboard/import");
}

async function fetchPlaylist(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "PSTV/1.0" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

/** Fast bulk upsert using in-memory lookup maps. */
export async function upsertParsedChannels(
  items: ParsedM3uChannel[],
  options: {
    defaultCountry?: string;
    defaultCountryName?: string;
    markLocal?: boolean;
  } = {},
): Promise<{ created: number; updated: number; skipped: number }> {
  const deduped = dedupeChannels(items);
  if (deduped.length === 0) return { created: 0, updated: 0, skipped: 0 };

  const existing = await prisma.channel.findMany({
    select: {
      id: true,
      externalId: true,
      streamUrl: true,
      slug: true,
      logoUrl: true,
      language: true,
    },
  });

  const byExternal = new Map(
    existing.filter((e) => e.externalId).map((e) => [e.externalId!, e]),
  );
  const byUrl = new Map(existing.map((e) => [e.streamUrl, e]));
  const usedSlugs = new Set(existing.map((e) => e.slug));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  const toCreate: Array<{
    name: string;
    slug: string;
    streamUrl: string;
    logoUrl: string | null;
    country: string;
    countryName: string | null;
    language: string | null;
    category: string;
    isLocal: boolean;
    externalId: string;
    sortOrder: number;
  }> = [];

  let sortOrder = existing.length;

  for (const item of deduped) {
    const name = item.name.trim();
    const streamUrl = item.streamUrl.trim();
    if (!name || !streamUrl) {
      skipped += 1;
      continue;
    }

    const country = (
      item.country ||
      options.defaultCountry ||
      "XX"
    ).toUpperCase();
    const countryName =
      item.countryName ||
      options.defaultCountryName ||
      getCountryLongName(country);
    const language =
      item.language || languageForCountry(country) || null;
    const isLocal = options.markLocal ?? country === "LK";
    const category = normalizeCategory(item.category);
    const externalId =
      item.externalId?.trim() ||
      `m3u:${generateSlug(name)}:${Buffer.from(streamUrl)
        .toString("base64url")
        .slice(0, 16)}`;

    const found = byExternal.get(externalId) || byUrl.get(streamUrl);
    if (found) {
      await prisma.channel.update({
        where: { id: found.id },
        data: {
          name,
          streamUrl,
          logoUrl: item.logoUrl || found.logoUrl,
          country,
          countryName,
          language: language || found.language,
          category,
          isLocal,
          isHidden: false,
          externalId: found.externalId || externalId,
        },
      });
      updated += 1;
      continue;
    }

    let slug = generateSlug(name);
    if (!slug) slug = `channel-${Date.now().toString(36)}-${created}`;
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
      language: language,
      category,
      isLocal,
      externalId,
      sortOrder: sortOrder++,
    });
    created += 1;
  }

  const chunkSize = 150;
  for (let i = 0; i < toCreate.length; i += chunkSize) {
    const chunk = toCreate.slice(i, i + chunkSize);
    await prisma.channel.createMany({
      data: chunk,
      skipDuplicates: true,
    });
  }

  return { created, updated, skipped };
}

export async function importM3uPlaylist(input: {
  source: string;
  defaultCountry?: string;
  defaultCountryName?: string;
  markLocal?: boolean;
}): Promise<ImportResult> {
  try {
    await requireImportPermission();

    const raw = input.source.trim();
    if (!raw) return { success: false, error: "M3U URL or playlist text is required." };

    let content = raw;
    if (/^https?:\/\//i.test(raw) && !raw.includes("#EXTINF")) {
      const downloaded = await fetchPlaylist(raw);
      if (!downloaded) {
        return { success: false, error: "Failed to download playlist." };
      }
      content = downloaded;
    }

    const parsed = parseM3u(content);
    if (parsed.length === 0) {
      return { success: false, error: "No channels found in playlist." };
    }

    const result = await upsertParsedChannels(parsed, {
      defaultCountry: input.defaultCountry,
      defaultCountryName: input.defaultCountryName,
      markLocal: input.markLocal,
    });

    revalidateCatalog();
    return { success: true, total: parsed.length, ...result };
  } catch (e) {
    console.error("[importM3uPlaylist]", e);
    return {
      success: false,
      error:
        e instanceof Error && e.message === "Unauthorized"
          ? "Unauthorized"
          : "Import failed.",
    };
  }
}

export async function importIptvOrgCountry(input: {
  country: string;
  markLocal?: boolean;
}): Promise<ImportResult> {
  const code = input.country.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) {
    return { success: false, error: "Use a 2-letter country code (e.g. lk, us, in)." };
  }

  return importM3uPlaylist({
    source: countryPlaylistUrl(code),
    defaultCountry: code.toUpperCase(),
    defaultCountryName: getCountryLongName(code),
    markLocal: input.markLocal ?? code === "lk",
  });
}

export async function importIptvOrgCategory(input: {
  category: string;
  limit?: number;
}): Promise<ImportResult> {
  try {
    await requireImportPermission();
    const category = input.category.trim().toLowerCase();
    const limit = input.limit ? Math.min(Math.max(input.limit, 1), 5000) : undefined;
    const content = await fetchPlaylist(categoryPlaylistUrl(category));
    if (!content) {
      return { success: false, error: `Category playlist not found (${category}).` };
    }

    const parsed = limit ? parseM3u(content).slice(0, limit) : parseM3u(content);
    const result = await upsertParsedChannels(parsed, { markLocal: false });
    revalidateCatalog();
    return { success: true, total: parsed.length, ...result };
  } catch (e) {
    console.error("[importIptvOrgCategory]", e);
    return { success: false, error: "Category import failed." };
  }
}

/**
 * Import ALL local (LK) channels + free-to-air catalogs
 * from iptv-org country + category playlists.
 */
export async function importAllLocalAndFta(): Promise<ImportResult> {
  try {
    await requireImportPermission();

    const urls = [
      ...FTA_COUNTRIES.map((c) => ({
        url: countryPlaylistUrl(c.code),
        defaultCountry: c.code.toUpperCase(),
        defaultCountryName: c.name,
        markLocal: c.code === "lk",
      })),
      ...FTA_CATEGORIES.map((category) => ({
        url: categoryPlaylistUrl(category),
        defaultCountry: "XX",
        defaultCountryName: "International",
        markLocal: false,
      })),
    ];

    const collected: ParsedM3uChannel[] = [];
    let sources = 0;

    // Fetch in parallel batches to avoid flooding
    const batchSize = 8;
    for (let i = 0; i < urls.length; i += batchSize) {
      const batch = urls.slice(i, i + batchSize);
      const texts = await Promise.all(batch.map((b) => fetchPlaylist(b.url)));
      texts.forEach((text, idx) => {
        if (!text) return;
        sources += 1;
        const meta = batch[idx];
        const parsed = parseM3u(text).map((ch) => ({
          ...ch,
          country: ch.country || meta.defaultCountry,
          countryName:
            ch.countryName ||
            getCountryLongName(ch.country || meta.defaultCountry) ||
            meta.defaultCountryName,
        }));
        // Force local flag for LK
        for (const ch of parsed) {
          if ((ch.country || "").toUpperCase() === "LK" || meta.markLocal) {
            collected.push({ ...ch, country: "LK", countryName: "Sri Lanka" });
          } else {
            collected.push(ch);
          }
        }
      });
    }

    const deduped = dedupeChannels(collected);
    // Ensure LK channels marked local during upsert
    const result = await upsertParsedChannels(deduped, { markLocal: false });

    // Explicitly mark Sri Lanka channels as local
    await prisma.channel.updateMany({
      where: { country: "LK" },
      data: { isLocal: true, countryName: "Sri Lanka", isHidden: false },
    });

    revalidateCatalog();
    return {
      success: true,
      total: deduped.length,
      sources,
      ...result,
    };
  } catch (e) {
    console.error("[importAllLocalAndFta]", e);
    return {
      success: false,
      error:
        e instanceof Error && e.message === "Unauthorized"
          ? "Unauthorized"
          : "Full FTA import failed.",
    };
  }
}

export async function syncInternationalChannels(limit = 300): Promise<ImportResult> {
  try {
    await requireImportPermission();
    const cats = ["news", "sports", "entertainment", "kids", "movies", "music"];
    const texts = await Promise.all(
      cats.map((c) => fetchPlaylist(categoryPlaylistUrl(c))),
    );
    const per = Math.ceil(limit / cats.length);
    const parsed = texts.flatMap((text) =>
      text ? parseM3u(text).slice(0, per) : [],
    );
    const result = await upsertParsedChannels(parsed, { markLocal: false });
    revalidateCatalog();
    return { success: true, total: parsed.length, ...result };
  } catch (e) {
    console.error("[syncInternationalChannels]", e);
    return { success: false, error: "Sync failed." };
  }
}
