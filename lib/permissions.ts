import type { getCurrentUser } from "@/lib/session";

type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export function isSuperAdmin(user: CurrentUser): boolean {
  return user.roles.some((r) => r.role.slug === "super-admin");
}

export function isAdmin(user: CurrentUser): boolean {
  return user.roles.some((r) =>
    ["super-admin", "admin"].includes(r.role.slug),
  );
}

export function getUserPermissions(user: CurrentUser): string[] {
  return user.roles.flatMap((roleUser) =>
    roleUser.role.permissions.map((rolePerm) => rolePerm.permission.slug),
  );
}

export function hasPermission(user: CurrentUser, ...slugs: string[]): boolean {
  if (isSuperAdmin(user)) return true;
  const perms = getUserPermissions(user);
  return slugs.some((slug) => perms.includes(slug));
}

export function canAccessAdmin(user: CurrentUser): boolean {
  return (
    isAdmin(user) ||
    hasPermission(
      user,
      "overview-index",
      "channels-index",
      "users-index",
    )
  );
}
