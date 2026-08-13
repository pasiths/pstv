import "dotenv/config";
import { prisma } from "../lib/prisma";

/** Mark a batch of international Sports/Movies/Entertainment as Paid (locked). */
async function main() {
  const limit = Number(process.env.PREMIUM_TAG_LIMIT || 80);

  await prisma.channel.updateMany({
    where: { isLocal: true },
    data: { isPremium: false },
  });

  const candidates = await prisma.channel.findMany({
    where: {
      isHidden: false,
      isLocal: false,
      isPremium: false,
      category: { in: ["Sports", "Movies", "Entertainment"] },
    },
    orderBy: { name: "asc" },
    take: limit,
    select: { id: true, name: true },
  });

  if (candidates.length) {
    await prisma.channel.updateMany({
      where: { id: { in: candidates.map((c) => c.id) } },
      data: { isPremium: true },
    });
  }

  const [free, paid, local] = await Promise.all([
    prisma.channel.count({ where: { isHidden: false, isPremium: false } }),
    prisma.channel.count({ where: { isHidden: false, isPremium: true } }),
    prisma.channel.count({ where: { isHidden: false, isLocal: true } }),
  ]);

  console.log(`Tagged ${candidates.length} channels as Paid.`);
  console.log(`Visible totals → local=${local} free=${free} paid=${paid}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
