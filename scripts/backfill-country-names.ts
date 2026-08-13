/**
 * Backfill channel.countryName with long English names from ISO codes.
 * Run: npx tsx scripts/backfill-country-names.ts
 */
import { prisma } from "../lib/prisma";
import { getCountryLongName } from "../lib/iptv-catalog";

async function main() {
  const rows = await prisma.channel.findMany({
    select: { id: true, country: true, countryName: true },
  });

  let updated = 0;
  for (const row of rows) {
    const name = getCountryLongName(row.country);
    const needsUpdate =
      !row.countryName ||
      row.countryName === row.country ||
      row.countryName.length <= 3;
    if (!needsUpdate) continue;

    await prisma.channel.update({
      where: { id: row.id },
      data: { countryName: name },
    });
    updated += 1;
  }

  console.log(`Backfilled ${updated} / ${rows.length} channels`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
