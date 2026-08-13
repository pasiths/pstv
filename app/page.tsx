import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAccessAdmin } from "@/lib/permissions";
import { canAccessPremium, mapPublicChannel } from "@/lib/premium";
import { SiteHeader } from "@/components/layout/site-header";
import { SiteFooter } from "@/components/layout/site-footer";
import { TvWatcher } from "@/components/channels/tv-watcher";
import { getCountryLongName } from "@/lib/iptv-catalog";
import { getLanguageLongName } from "@/lib/languages";
import { SITE } from "@/lib/site";
import { withPsDemoFirst } from "@/lib/ps-demo";
import { getChannelCatalogStats } from "@/lib/channel-stats";

export const dynamic = "force-dynamic";

const PAGE_LIMIT = 72;

export default async function HomePage() {
  const user = await getCurrentUser();
  const entitled = canAccessPremium(user);
  const where = { isHidden: false };

  // Keep concurrent DB work low (serverless + small Aiven plans).
  const [stats, channels, countries, languages, categories] = await Promise.all([
    getChannelCatalogStats(),
    prisma.channel.findMany({
      where,
      orderBy: [
        { isLocal: "desc" },
        { isBroken: "asc" },
        { isPremium: "asc" },
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
  ]);

  const { total, localCount, freeCount, paidCount } = stats;

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
    recentChannels = history.map((h) => h.channel).filter((c) => !c.isHidden);
  }

  const mapChannel = (c: (typeof channels)[number]) =>
    mapPublicChannel(
      {
        id: c.id,
        name: c.name,
        slug: c.slug,
        logoUrl: c.logoUrl,
        category: c.category,
        country: c.country,
        countryName: getCountryLongName(c.country),
        language: c.language,
        isLocal: c.isLocal,
        isPremium: c.isPremium,
        isBroken: c.isBroken,
        streamUrl: c.streamUrl,
      },
      entitled,
    );

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
            {SITE.tagline}
          </p>
          <h1 className="font-heading mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">
            {SITE.name}
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            {localCount.toLocaleString()} local LK · {freeCount.toLocaleString()} free ·{" "}
            {paidCount.toLocaleString()} paid · {total.toLocaleString()} total.
            Installable on iPhone, Android, and Windows as a web app.{" "}
            <span className="text-foreground/80">{SITE.educationNotice}</span>{" "}
            <span className="text-foreground/90">{SITE.channelThanks}</span>
          </p>
        </div>
        <TvWatcher
          initialChannels={withPsDemoFirst(channels.map(mapChannel))}
          initialTotal={Math.max(total, 1)}
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
            categories: [
              "All",
              "Free",
              "Paid",
              ...categories.map((c) => c.category),
            ],
          }}
          favoriteIds={favoriteIds}
          recentChannels={recentChannels.map(mapChannel)}
          userName={user?.name}
          hasPremium={entitled}
          enableChat
          pageSize={PAGE_LIMIT}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
