import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { generateSlug } from "@/lib/utils";
import { normalizeCategory, parseM3u } from "@/lib/m3u";

const LK_PLAYLIST = "https://iptv-org.github.io/iptv/countries/lk.m3u";

const DEFAULT_PASSWORD = "12345678";

async function upsertPermission(name: string, slug: string) {
  return prisma.permission.upsert({
    where: { slug },
    create: { name, slug },
    update: { name, inactive: false },
  });
}

async function upsertRole(name: string, slug: string) {
  return prisma.role.upsert({
    where: { slug },
    create: { name, slug },
    update: { name, inactive: false },
  });
}

async function ensureRolePermission(roleId: string, permissionId: string) {
  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: { roleId, permissionId },
    },
    create: { roleId, permissionId },
    update: {},
  });
}

async function upsertUser(input: {
  name: string;
  email: string;
  passwordHash: string;
  isPremium?: boolean;
  imageSeed: string;
  roleId: string;
}) {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    create: {
      name: input.name,
      email: input.email,
      password: input.passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isPremium: input.isPremium ?? false,
      image: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(input.imageSeed)}`,
    },
    update: {
      name: input.name,
      password: input.passwordHash,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      isPremium: input.isPremium ?? false,
      inactive: false,
      suspended: false,
    },
  });

  await prisma.roleUser.upsert({
    where: {
      userId_roleId: { userId: user.id, roleId: input.roleId },
    },
    create: { userId: user.id, roleId: input.roleId },
    update: {},
  });

  return user;
}

async function seedAuth() {
  const permissionsData = [
    { name: "View Dashboard", slug: "overview-index" },
    { name: "Manage Channels", slug: "channels-index" },
    { name: "Channel Create", slug: "channels-create" },
    { name: "Channel Update", slug: "channels-edit" },
    { name: "Channel Delete", slug: "channels-delete" },
    { name: "Manage Users", slug: "users-index" },
    { name: "User Create", slug: "users-create" },
    { name: "User Update", slug: "users-edit" },
    { name: "User Delete", slug: "users-delete" },
    { name: "Account Settings", slug: "account-settings-index" },
  ];

  const permissions = [];
  for (const p of permissionsData) {
    permissions.push(await upsertPermission(p.name, p.slug));
  }

  const superAdminRole = await upsertRole("Super Admin", "super-admin");
  const adminRole = await upsertRole("Admin", "admin");
  const premiumRole = await upsertRole("Premium", "premium");
  const userRole = await upsertRole("User", "user");

  for (const permission of permissions) {
    await ensureRolePermission(superAdminRole.id, permission.id);
    await ensureRolePermission(adminRole.id, permission.id);
  }

  const accountSettings = permissions.find(
    (p) => p.slug === "account-settings-index",
  );
  if (accountSettings) {
    await ensureRolePermission(userRole.id, accountSettings.id);
    await ensureRolePermission(premiumRole.id, accountSettings.id);
  }

  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, 10);

  await upsertUser({
    name: "FluxTV Super Admin",
    email: "superadmin@fluxtv.local",
    passwordHash,
    isPremium: true,
    imageSeed: "FluxSuperAdmin",
    roleId: superAdminRole.id,
  });

  await upsertUser({
    name: "FluxTV Admin",
    email: "admin@fluxtv.local",
    passwordHash,
    isPremium: true,
    imageSeed: "FluxAdmin",
    roleId: adminRole.id,
  });

  await upsertUser({
    name: "FluxTV Premium",
    email: "premium@fluxtv.local",
    passwordHash,
    isPremium: true,
    imageSeed: "FluxPremium",
    roleId: premiumRole.id,
  });

  await upsertUser({
    name: "FluxTV Free User",
    email: "user@fluxtv.local",
    passwordHash,
    isPremium: false,
    imageSeed: "FluxUser",
    roleId: userRole.id,
  });

  return {
    roles: {
      superAdmin: superAdminRole.slug,
      admin: adminRole.slug,
      premium: premiumRole.slug,
      user: userRole.slug,
    },
  };
}

async function seedLocalChannels() {
  console.log("📡 Fetching Sri Lanka streams from iptv-org...");
  const playlistRes = await fetch(LK_PLAYLIST, {
    headers: { "User-Agent": "FluxTV-Seed/1.0" },
    cache: "no-store",
  });

  if (!playlistRes.ok) {
    throw new Error(`Failed to download LK playlist (${playlistRes.status})`);
  }

  const parsed = parseM3u(await playlistRes.text());
  let created = 0;
  let updated = 0;
  let sortOrder = await prisma.channel.count();

  for (const item of parsed) {
    const externalId = item.externalId || `lk:${generateSlug(item.name)}`;
    const existing =
      (await prisma.channel.findUnique({ where: { externalId } })) ||
      (await prisma.channel.findFirst({
        where: { streamUrl: item.streamUrl },
      }));

    if (existing) {
      await prisma.channel.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          streamUrl: item.streamUrl,
          logoUrl: item.logoUrl || existing.logoUrl,
          country: "LK",
          countryName: "Sri Lanka",
          language: item.language || existing.language,
          category: normalizeCategory(item.category),
          isLocal: true,
          isPremium: false,
          isHidden: false,
          externalId,
        },
      });
      updated += 1;
      continue;
    }

    let slug = generateSlug(item.name);
    if (!slug) slug = `channel-${sortOrder}`;
    const slugTaken = await prisma.channel.findUnique({ where: { slug } });
    if (slugTaken) slug = `${slug}-${sortOrder}`;

    await prisma.channel.create({
      data: {
        name: item.name,
        slug,
        streamUrl: item.streamUrl,
        logoUrl:
          item.logoUrl ||
          `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(item.name)}&backgroundColor=0f766e`,
        country: "LK",
        countryName: "Sri Lanka",
        language: item.language,
        category: normalizeCategory(item.category),
        isLocal: true,
        isPremium: false,
        externalId,
        sortOrder,
      },
    });
    created += 1;
    sortOrder += 1;
  }

  await prisma.channel.updateMany({
    where: { country: "LK" },
    data: {
      isLocal: true,
      countryName: "Sri Lanka",
      isHidden: false,
      isPremium: false,
    },
  });

  // Ensure there are some paid channels for freemium testing.
  const paidCount = await prisma.channel.count({
    where: { isPremium: true, isHidden: false },
  });
  if (paidCount === 0) {
    const candidates = await prisma.channel.findMany({
      where: {
        isHidden: false,
        isLocal: false,
        category: { in: ["Sports", "Movies", "Entertainment"] },
      },
      orderBy: { name: "asc" },
      take: 40,
      select: { id: true },
    });
    if (candidates.length) {
      await prisma.channel.updateMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        data: { isPremium: true },
      });
    }
  }

  const first = await prisma.channel.findFirst({
    where: { isLocal: true, isHidden: false },
    orderBy: { sortOrder: "asc" },
  });
  if (first) {
    const existingEpg = await prisma.epgEntry.count({
      where: { channelId: first.id },
    });
    if (existingEpg === 0) {
      const now = new Date();
      const hour = 60 * 60 * 1000;
      await prisma.epgEntry.createMany({
        data: [
          {
            channelId: first.id,
            title: "Live broadcast",
            description: "Now on air",
            startsAt: new Date(now.getTime() - hour),
            endsAt: new Date(now.getTime() + hour),
          },
          {
            channelId: first.id,
            title: "Upcoming program",
            description: "Next on this channel",
            startsAt: new Date(now.getTime() + hour),
            endsAt: new Date(now.getTime() + 2 * hour),
          },
        ],
      });
    }
  }

  return { playlist: parsed.length, created, updated };
}

async function main() {
  console.log("🌱 Seeding FluxTV (safe upsert — keeps existing catalog)…");

  await seedAuth();
  const channels = await seedLocalChannels();

  const [local, free, paid] = await Promise.all([
    prisma.channel.count({ where: { isLocal: true, isHidden: false } }),
    prisma.channel.count({ where: { isPremium: false, isHidden: false } }),
    prisma.channel.count({ where: { isPremium: true, isHidden: false } }),
  ]);

  console.log("✅ Seed complete.");
  console.log(`   Password for all seed users: ${DEFAULT_PASSWORD}`);
  console.log("   superadmin@fluxtv.local  (super-admin + premium)");
  console.log("   admin@fluxtv.local       (admin + premium)");
  console.log("   premium@fluxtv.local     (premium access)");
  console.log("   user@fluxtv.local        (free user)");
  console.log(
    `   LK playlist: ${channels.playlist} (created ${channels.created}, updated ${channels.updated})`,
  );
  console.log(`   Catalog: local=${local} free=${free} paid=${paid}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
