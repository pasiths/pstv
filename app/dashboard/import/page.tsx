import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canAccessAdmin, hasPermission } from "@/lib/permissions";
import { SiteHeader } from "@/components/layout/site-header";
import { ChannelImportPanel } from "@/components/channels/channel-import-panel";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function ImportChannelsPage() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user) || !hasPermission(user, "channels-index")) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen">
      <SiteHeader user={{ name: user.name, email: user.email }} isAdmin />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-semibold">Import channels</h1>
            <p className="text-sm text-muted-foreground">
              Pull real free streams from iptv-org or your own M3U playlists.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard/channels">Back to channels</Link>
          </Button>
        </div>
        <ChannelImportPanel />
      </main>
    </div>
  );
}
