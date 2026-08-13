import "dotenv/config";
import { prisma } from "../lib/prisma";
import { repairStreamUrl } from "../lib/stream-health";

async function main() {
  const take = Number(process.env.REPAIR_LIMIT || 200);
  const channels = await prisma.channel.findMany({
    where: { isHidden: false },
    select: { id: true, name: true, streamUrl: true, externalId: true },
    orderBy: [{ isBroken: "desc" }, { lastCheckedAt: "asc" }],
    take,
  });

  console.log(`Repairing up to ${channels.length} channels…`);
  let repaired = 0;
  let working = 0;
  let broken = 0;

  for (const ch of channels) {
    const result = await repairStreamUrl({
      streamUrl: ch.streamUrl,
      externalId: ch.externalId,
    });
    await prisma.channel.update({
      where: { id: ch.id },
      data: {
        streamUrl: result.url,
        isBroken: !result.working,
        lastCheckedAt: new Date(),
      },
    });
    if (result.repaired) {
      repaired += 1;
      console.log(`[REPAIRED] ${ch.name}`);
    } else if (result.working) {
      working += 1;
    } else {
      broken += 1;
      console.log(`[NOT WORKING] ${ch.name}`);
    }
  }

  console.log(
    `\nDone. still-ok=${working} repaired=${repaired} not-working=${broken}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
