import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/layout/site-header";
import { canAccessAdmin } from "@/lib/permissions";
import { canAccessPremium, mapPublicChannel } from "@/lib/premium";
import { TvWatcher } from "@/components/channels/tv-watcher";
import { getCountryLongName } from "@/lib/iptv-catalog";

export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const entitled = canAccessPremium(user);

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    include: { channel: true },
    orderBy: { createdAt: "desc" },
  });

  const channels = favorites
    .map((f) => f.channel)
    .filter((c) => !c.isHidden)
    .map((c) =>
      mapPublicChannel(
        {
          id: c.id,
          name: c.name,
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
      ),
    );

  return (
    <div className="min-h-screen">
      <SiteHeader
        user={{ name: user.name, email: user.email }}
        isAdmin={canAccessAdmin(user)}
      />
      <main className="mx-auto max-w-7xl space-y-6 px-4 py-8">
        <div>
          <h1 className="font-heading text-3xl font-semibold">My List</h1>
          <p className="text-sm text-muted-foreground">
            Channels you marked as favorites.
          </p>
        </div>
        <TvWatcher
          initialChannels={channels}
          initialTotal={channels.length}
          favoriteIds={channels.map((c) => c.id)}
          hasPremium={entitled}
          localCatalog
        />
      </main>
    </div>
  );
}
