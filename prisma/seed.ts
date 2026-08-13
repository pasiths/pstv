import { prisma } from "@/lib/prisma";
import * as bcrypt from "bcryptjs";
import { generateSlug } from "@/lib/utils";

const DEMO_STREAMS = [
  "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
  "https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8",
  "https://cph-p2p-msl.akamaized.net/hls/live/2000341/test/master.m3u8",
];

const LOCAL_CHANNELS = [
  { name: "Rupavahini", category: "General", language: "si" },
  { name: "ITN", category: "News", language: "si" },
  { name: "Sirasa TV", category: "Entertainment", language: "si" },
  { name: "TV Derana", category: "Entertainment", language: "si" },
  { name: "Hiru TV", category: "Entertainment", language: "si" },
  { name: "Swarnavahini", category: "General", language: "si" },
  { name: "Channel Eye", category: "Kids", language: "si" },
  { name: "Siyatha TV", category: "News", language: "si" },
  { name: "Ada Derana 24", category: "News", language: "si" },
  { name: "TV1", category: "General", language: "si" },
  { name: "Shakthi TV", category: "Entertainment", language: "ta" },
  { name: "Vasantham TV", category: "Entertainment", language: "ta" },
  { name: "Dialog Cricket", category: "Sports", language: "en" },
];

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

  const userPerms = permissions.filter((p) =>
    p.slug === "account-settings-index",
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

  for (let i = 0; i < LOCAL_CHANNELS.length; i++) {
    const ch = LOCAL_CHANNELS[i];
    await prisma.channel.create({
      data: {
        name: ch.name,
        slug: generateSlug(ch.name),
        streamUrl: DEMO_STREAMS[i % DEMO_STREAMS.length],
        logoUrl: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(ch.name)}&backgroundColor=0f766e`,
        country: "LK",
        countryName: "Sri Lanka",
        language: ch.language,
        category: ch.category,
        isLocal: true,
        sortOrder: i,
      },
    });
  }

  // Sample EPG for first channel
  const first = await prisma.channel.findFirst({ where: { isLocal: true } });
  if (first) {
    const now = new Date();
    const hour = 60 * 60 * 1000;
    await prisma.epgEntry.createMany({
      data: [
        {
          channelId: first.id,
          title: "Morning News",
          description: "Daily headlines and updates",
          startsAt: new Date(now.getTime() - hour),
          endsAt: new Date(now.getTime() + hour),
        },
        {
          channelId: first.id,
          title: "Prime Time Drama",
          description: "Evening entertainment",
          startsAt: new Date(now.getTime() + hour),
          endsAt: new Date(now.getTime() + 2 * hour),
        },
      ],
    });
  }

  console.log("✅ Seed complete.");
  console.log("   Admin: superadmin@fluxtv.local / 12345678");
  console.log(`   Local channels: ${LOCAL_CHANNELS.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
