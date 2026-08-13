/**
 * Backfill channel.language from country primary language when missing.
 * Run: npx tsx scripts/backfill-languages.ts
 */
import { prisma } from "../lib/prisma";
import { PRIMARY_LANGUAGE_BY_COUNTRY } from "../lib/languages";

async function main() {
  let updated = 0;
  for (const [country, language] of Object.entries(PRIMARY_LANGUAGE_BY_COUNTRY)) {
    const result = await prisma.channel.updateMany({
      where: {
        country,
        OR: [{ language: null }, { language: "" }],
      },
      data: { language },
    });
    updated += result.count;
    if (result.count) {
      console.log(`${country} -> ${language}: ${result.count}`);
    }
  }
  console.log(`Backfilled language on ${updated} channels`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
