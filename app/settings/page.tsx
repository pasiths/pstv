import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { canAccessAdmin } from "@/lib/permissions";
import { SiteHeader } from "@/components/layout/site-header";
import { SettingsForm } from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <SiteHeader
        user={{ name: user.name, email: user.email }}
        isAdmin={canAccessAdmin(user)}
      />
      <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
        <div>
          <h1 className="font-heading text-3xl font-semibold">Account settings</h1>
          <p className="text-sm text-muted-foreground">
            Manage your profile and password.
          </p>
        </div>
        <SettingsForm
          name={user.name}
          email={user.email}
          phoneNo={user.phoneNo}
        />
      </main>
    </div>
  );
}
