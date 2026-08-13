import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAccessAdmin } from "@/lib/permissions";
import { SiteHeader } from "@/components/layout/site-header";
import { TvWatcher } from "@/components/channels/tv-watcher";
import { getCountryLongName } from "@/lib/iptv-catalog";
import { getLanguageLongName } from "@/lib/languages";

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 48;

export default async function HomePage() {
  const user = await getCurrentUser();

  const where = { isHidden: false };

  const [total, channels, countries, languages, categories, localCount] =
    await Promise.all([
      prisma.channel.count({ where }),
      prisma.channel.findMany({
        where,
        orderBy: [
          { isLocal: "desc" },
          { isBroken: "asc" },
          { sortOrder: "asc" },
          { name: "asc" },
        ],
        take: PAGE_LIMIT,
      }),
      prisma.channel.findMany({
        where,
        distinct: ["country"],
        select: { country: true },
        orderBy: { country: "asc" },
        take: 300,
      }),
      prisma.channel.findMany({
        where: { ...where, language: { not: null } },
        distinct: ["language"],
        select: { language: true },
        orderBy: { language: "asc" },
        take: 200,
      }),
      prisma.channel.findMany({
        where,
        distinct: ["category"],
        select: { category: true },
        orderBy: { category: "asc" },
        take: 100,
      }),
      prisma.channel.count({ where: { isHidden: false, isLocal: true } }),
    ]);

  let favoriteIds: string[] = [];
  let recentChannels: typeof channels = [];

  if (user) {
    const [favorites, history] = await Promise.all([
      prisma.favorite.findMany({
        where: { userId: user.id },
        select: { channelId: true },
      }),
      prisma.watchHistory.findMany({
        where: { userId: user.id },
        orderBy: { watchedAt: "desc" },
        take: 8,
        include: { channel: true },
      }),
    ]);
    favoriteIds = favorites.map((f) => f.channelId);
    recentChannels = history
      .map((h) => h.channel)
      .filter((c) => !c.isHidden);
  }

  const mapChannel = (c: (typeof channels)[number]) => ({
    id: c.id,
    name: c.name,
    logoUrl: c.logoUrl,
    category: c.category,
    country: c.country,
    countryName: getCountryLongName(c.country),
    language: c.language,
    isLocal: c.isLocal,
    isBroken: c.isBroken,
    streamUrl: c.streamUrl,
  });

  const countryFacets = countries
    .filter((c) => c.country)
    .map((c) => ({
      code: c.country,
      name: getCountryLongName(c.country),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader
        user={user ? { name: user.name, email: user.email } : null}
        isAdmin={user ? canAccessAdmin(user) : false}
      />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">
        <div className="mb-6">
          <p className="text-xs font-medium tracking-[0.2em] text-teal-500 uppercase">
            Free live television
          </p>
          <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            FluxTV
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {localCount} local LK channels and {total.toLocaleString()} free-to-air
            streams worldwide. Search, filter by country/category, and cast to TV.
          </p>
        </div>
        <TvWatcher
          initialChannels={channels.map(mapChannel)}
          initialTotal={total}
          facets={{
            countries: [{ code: "All", name: "All countries" }, ...countryFacets],
            languages: [
              { code: "All", name: "All languages" },
              ...languages
                .map((l) => l.language)
                .filter((v): v is string => Boolean(v))
                .map((code) => ({
                  code,
                  name: getLanguageLongName(code),
                }))
                .sort((a, b) => a.name.localeCompare(b.name)),
            ],
            categories: ["All", ...categories.map((c) => c.category)],
          }}
          favoriteIds={favoriteIds}
          recentChannels={recentChannels.map(mapChannel)}
          userName={user?.name}
          enableChat
          pageSize={PAGE_LIMIT}
        />
      </main>
    </div>
  );
}
