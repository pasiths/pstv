import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { canAccessAdmin } from "@/lib/permissions";
import { SiteHeader } from "@/components/layout/site-header";
import { TvWatcher } from "@/components/channels/tv-watcher";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await getCurrentUser();

  const channels = await prisma.channel.findMany({
    where: { isHidden: false },
    orderBy: [{ isLocal: "desc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

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

  const now = new Date();
  const firstLocal = channels.find((c) => c.isLocal);
  let epgTitle: string | null = null;
  let epgNext: string | null = null;
  if (firstLocal) {
    const entries = await prisma.epgEntry.findMany({
      where: { channelId: firstLocal.id },
      orderBy: { startsAt: "asc" },
    });
    const current = entries.find((e) => e.startsAt <= now && e.endsAt > now);
    const upcoming = entries.find((e) => e.startsAt > now);
    epgTitle = current?.title ?? null;
    epgNext = upcoming?.title ?? null;
  }

  const mapped = channels.map((c) => ({
    id: c.id,
    name: c.name,
    logoUrl: c.logoUrl,
    category: c.category,
    country: c.country,
    language: c.language,
    isLocal: c.isLocal,
    isBroken: c.isBroken,
    streamUrl: c.streamUrl,
  }));

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
            Local Sri Lankan channels first, with global free streams, search,
            and a dark developer-friendly player.
          </p>
        </div>
        <TvWatcher
          channels={mapped}
          favoriteIds={favoriteIds}
          recentChannels={recentChannels.map((c) => ({
            id: c.id,
            name: c.name,
            logoUrl: c.logoUrl,
            category: c.category,
            country: c.country,
            language: c.language,
            isLocal: c.isLocal,
            isBroken: c.isBroken,
            streamUrl: c.streamUrl,
          }))}
          epgTitle={epgTitle}
          epgNext={epgNext}
          enableFilters
          userName={user?.name}
          enableChat
        />
      </main>
    </div>
  );
}
