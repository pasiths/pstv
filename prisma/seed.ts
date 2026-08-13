import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { generateSlug } from "@/lib/utils";
import { normalizeCategory, parseM3u } from "@/lib/m3u";

const LK_PLAYLIST = "https://iptv-org.github.io/iptv/countries/lk.m3u";

async function main() {
  console.log("🌱 Seeding FluxTV...");

  await prisma.watchHistory.deleteMany({});
  await prisma.favorite.deleteMany({});
  await prisma.epgEntry.deleteMany({});
  await prisma.channel.deleteMany({});
  await prisma.roleUser.deleteMany({});
  await prisma.rolePermission.deleteMany({});
  await prisma.permission.deleteMany({});
  await prisma.role.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.account.deleteMany({});
  await prisma.verification.deleteMany({});
  await prisma.user.deleteMany({});

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

  const permissions = await Promise.all(
    permissionsData.map((p) => prisma.permission.create({ data: p })),
  );

  const superAdminRole = await prisma.role.create({
    data: { name: "Super Admin", slug: "super-admin" },
  });
  const adminRole = await prisma.role.create({
    data: { name: "Admin", slug: "admin" },
  });
  const userRole = await prisma.role.create({
    data: { name: "User", slug: "user" },
  });

  await prisma.rolePermission.createMany({
    data: permissions.flatMap((permission) => [
      { roleId: superAdminRole.id, permissionId: permission.id },
      { roleId: adminRole.id, permissionId: permission.id },
    ]),
  });

  const userPerms = permissions.filter(
    (p) => p.slug === "account-settings-index",
  );
  await prisma.rolePermission.createMany({
    data: userPerms.map((permission) => ({
      roleId: userRole.id,
      permissionId: permission.id,
    })),
  });

  const hashedPassword = await bcrypt.hash("12345678", 10);

  const superAdmin = await prisma.user.create({
    data: {
      name: "FluxTV Super Admin",
      email: "superadmin@fluxtv.local",
      password: hashedPassword,
      emailVerified: true,
      emailVerifiedAt: new Date(),
      image: "https://api.dicebear.com/7.x/avataaars/svg?seed=FluxAdmin",
    },
  });

  await prisma.roleUser.create({
    data: { userId: superAdmin.id, roleId: superAdminRole.id },
  });

  console.log("📡 Fetching real Sri Lanka streams from iptv-org...");
  const playlistRes = await fetch(LK_PLAYLIST, {
    headers: { "User-Agent": "FluxTV-Seed/1.0" },
  });

  if (!playlistRes.ok) {
    throw new Error(`Failed to download LK playlist (${playlistRes.status})`);
  }

  const parsed = parseM3u(await playlistRes.text());
  let sortOrder = 0;

  for (const item of parsed) {
    const externalId = item.externalId || `lk:${generateSlug(item.name)}`;
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
        externalId,
        sortOrder,
      },
    });
    sortOrder += 1;
  }

  const first = await prisma.channel.findFirst({
    where: { isLocal: true },
    orderBy: { sortOrder: "asc" },
  });
  if (first) {
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

  console.log("✅ Seed complete.");
  console.log("   Admin: superadmin@fluxtv.local / 12345678");
  console.log(`   Real LK channels imported: ${parsed.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
