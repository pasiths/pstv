import type { getCurrentUser } from "@/lib/session";
import { isAdmin } from "@/lib/permissions";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/** Whether this viewer can play paid / premium channels. */
export function canAccessPremium(
  user: CurrentUser | null | undefined,
): boolean {
  if (!user) return false;
  if (user.isPremium) return true;
  if (isAdmin(user)) return true;
  return user.roles.some((r) =>
    ["premium", "super-admin", "admin"].includes(r.role.slug),
  );
}

export function mapPublicChannel<
  T extends {
    streamUrl: string;
    isPremium: boolean;
    isBroken?: boolean;
  },
>(channel: T, entitled: boolean) {
  const locked = Boolean(channel.isPremium && !entitled);
  return {
    ...channel,
    locked,
    streamUrl: locked ? "" : channel.streamUrl,
  };
}
