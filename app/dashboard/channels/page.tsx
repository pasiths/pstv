import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canAccessAdmin, hasPermission } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/layout/site-header";
import { ChannelsAdmin } from "@/components/channels/channels-admin";

export const dynamic = "force-dynamic";

export default async function ChannelsAdminPage() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user) || !hasPermission(user, "channels-index")) {
    redirect("/login");
  }

  const channels = await prisma.channel.findMany({
    orderBy: [{ isLocal: "desc" }, { name: "asc" }],
  });

  return (
    <div className="min-h-screen">
      <SiteHeader user={{ name: user.name, email: user.email }} isAdmin />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div>
          <h1 className="font-heading text-3xl font-semibold">Channel management</h1>
          <p className="text-sm text-muted-foreground">
            Add, edit, hide, or delete stream sources.
          </p>
        </div>
        <ChannelsAdmin
          channels={channels.map((c) => ({
            id: c.id,
            name: c.name,
            streamUrl: c.streamUrl,
            logoUrl: c.logoUrl,
            country: c.country,
            countryName: c.countryName,
            language: c.language,
            category: c.category,
            isLocal: c.isLocal,
            isHidden: c.isHidden,
            isBroken: c.isBroken,
          }))}
        />
      </main>
    </div>
  );
}
