"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { generateSlug } from "@/lib/utils";
import { normalizeCategory, parseM3u, type ParsedM3uChannel } from "@/lib/m3u";
import { revalidatePath } from "next/cache";

export type ImportResult = {
  success: boolean;
  error?: string;
  created?: number;
  updated?: number;
  skipped?: number;
  total?: number;
};

async function requireImportPermission() {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "channels-create", "channels-index")) {
    throw new Error("Unauthorized");
  }
  return user;
}

async function upsertParsedChannels(
  items: ParsedM3uChannel[],
  options: {
    defaultCountry?: string;
    defaultCountryName?: string;
    markLocal?: boolean;
  } = {},
): Promise<{ created: number; updated: number; skipped: number }> {
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const item of items) {
    const name = item.name.trim();
    const streamUrl = item.streamUrl.trim();
    if (!name || !streamUrl) {
      skipped += 1;
      continue;
    }

    const country = (item.country || options.defaultCountry || "XX").toUpperCase();
    const countryName =
      item.countryName ||
      options.defaultCountryName ||
      (country === "LK" ? "Sri Lanka" : country);
    const isLocal = options.markLocal ?? country === "LK";
    const category = normalizeCategory(item.category);
    const externalId =
      item.externalId?.trim() ||
      `m3u:${generateSlug(name)}:${Buffer.from(streamUrl).toString("base64url").slice(0, 16)}`;

    const existingByExternal = await prisma.channel.findUnique({
      where: { externalId },
    });
    const existingByUrl =
      existingByExternal ??
      (await prisma.channel.findFirst({ where: { streamUrl } }));

    if (existingByUrl) {
      await prisma.channel.update({
        where: { id: existingByUrl.id },
        data: {
          name,
          streamUrl,
          logoUrl: item.logoUrl || existingByUrl.logoUrl,
          country,
          countryName,
          language: item.language || existingByUrl.language,
          category,
          isLocal,
          isBroken: false,
          externalId: existingByUrl.externalId || externalId,
        },
      });
      updated += 1;
      continue;
    }

    let slug = generateSlug(name);
    if (!slug) slug = `channel-${Date.now().toString(36)}`;
    const slugTaken = await prisma.channel.findUnique({ where: { slug } });
    if (slugTaken) slug = `${slug}-${externalId.slice(-6).replace(/[^a-z0-9]/gi, "")}`;

    await prisma.channel.create({
      data: {
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
      },
    });
    created += 1;
  }

  return { created, updated, skipped };
}

/** Import channels from pasted M3U text or a remote M3U URL. */
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
      const res = await fetch(raw, {
        headers: { "User-Agent": "FluxTV/1.0" },
        cache: "no-store",
      });
      if (!res.ok) {
        return { success: false, error: `Failed to download playlist (${res.status}).` };
      }
      content = await res.text();
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

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/channels");
    revalidatePath("/dashboard/import");

    return {
      success: true,
      total: parsed.length,
      ...result,
    };
  } catch (e) {
    console.error("[importM3uPlaylist]", e);
    return {
      success: false,
      error: e instanceof Error && e.message === "Unauthorized" ? "Unauthorized" : "Import failed.",
    };
  }
}

/** Import from iptv-org country playlist (real streams). */
export async function importIptvOrgCountry(input: {
  country: string;
  markLocal?: boolean;
}): Promise<ImportResult> {
  const code = input.country.trim().toLowerCase();
  if (!/^[a-z]{2}$/.test(code)) {
    return { success: false, error: "Use a 2-letter country code (e.g. lk, us, in)." };
  }

  const url = `https://iptv-org.github.io/iptv/countries/${code}.m3u`;
  return importM3uPlaylist({
    source: url,
    defaultCountry: code.toUpperCase(),
    defaultCountryName: code.toUpperCase() === "LK" ? "Sri Lanka" : code.toUpperCase(),
    markLocal: input.markLocal ?? code === "lk",
  });
}

/** Import popular category playlists from iptv-org. */
export async function importIptvOrgCategory(input: {
  category: string;
  limit?: number;
}): Promise<ImportResult> {
  try {
    await requireImportPermission();
    const category = input.category.trim().toLowerCase();
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 500);
    const url = `https://iptv-org.github.io/iptv/categories/${category}.m3u`;

    const res = await fetch(url, {
      headers: { "User-Agent": "FluxTV/1.0" },
      cache: "no-store",
    });
    if (!res.ok) {
      return { success: false, error: `Category playlist not found (${category}).` };
    }

    const parsed = parseM3u(await res.text()).slice(0, limit);
    const result = await upsertParsedChannels(parsed, {
      defaultCountry: "XX",
      markLocal: false,
    });

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/channels");
    revalidatePath("/dashboard/import");

    return { success: true, total: parsed.length, ...result };
  } catch (e) {
    console.error("[importIptvOrgCategory]", e);
    return { success: false, error: "Category import failed." };
  }
}

/** Legacy helper used by dashboard button — imports mixed international set. */
export async function syncInternationalChannels(limit = 150): Promise<ImportResult> {
  try {
    await requireImportPermission();

    const [news, sports, entertainment] = await Promise.all([
      fetch("https://iptv-org.github.io/iptv/categories/news.m3u", {
        cache: "no-store",
      }).then((r) => r.text()),
      fetch("https://iptv-org.github.io/iptv/categories/sports.m3u", {
        cache: "no-store",
      }).then((r) => r.text()),
      fetch("https://iptv-org.github.io/iptv/categories/entertainment.m3u", {
        cache: "no-store",
      }).then((r) => r.text()),
    ]);

    const per = Math.ceil(limit / 3);
    const parsed = [
      ...parseM3u(news).slice(0, per),
      ...parseM3u(sports).slice(0, per),
      ...parseM3u(entertainment).slice(0, per),
    ].slice(0, limit);

    const result = await upsertParsedChannels(parsed, { markLocal: false });

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/channels");

    return { success: true, total: parsed.length, ...result };
  } catch (e) {
    console.error("[syncInternationalChannels]", e);
    return { success: false, error: "Sync failed." };
  }
}
