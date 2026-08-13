import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { canAccessAdmin } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { checkBrokenLinks } from "@/actions/channels";
import { syncInternationalChannels } from "@/actions/sync";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user || !canAccessAdmin(user)) redirect("/login");

  const [total, local, international, hidden, broken, users] = await Promise.all([
    prisma.channel.count(),
    prisma.channel.count({ where: { isLocal: true } }),
    prisma.channel.count({ where: { isLocal: false } }),
    prisma.channel.count({ where: { isHidden: true } }),
    prisma.channel.count({ where: { isBroken: true } }),
    prisma.user.count(),
  ]);

  return (
    <div className="min-h-screen">
      <SiteHeader user={{ name: user.name, email: user.email }} isAdmin />
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-heading text-3xl font-semibold">Admin dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Control channels, sync catalogs, and monitor stream health.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/dashboard/import">Import channels</Link>
            </Button>
            <form
              action={async () => {
                "use server";
                await syncInternationalChannels(150);
              }}
            >
              <Button type="submit" variant="outline">
                Sync mixed catalog
              </Button>
            </form>
            <form
              action={async () => {
                "use server";
                await checkBrokenLinks();
              }}
            >
              <Button type="submit" variant="outline">
                Check broken links
              </Button>
            </form>
            <Button asChild>
              <Link href="/dashboard/channels">Manage channels</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { label: "Total channels", value: total },
            { label: "Local (LK)", value: local },
            { label: "International", value: international },
            { label: "Hidden", value: hidden },
            { label: "Broken links", value: broken },
            { label: "Users", value: users },
          ].map((stat) => (
            <Card key={stat.label} className="border-border/60 bg-card/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-heading text-3xl font-semibold tabular-nums">
                  {stat.value}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
