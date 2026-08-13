/**
 * Upsert PS Demo TV only (avoids full seed when DB connection limit is tight).
 * Usage: npx tsx scripts/upsert-ps-demo-channel.ts
 */
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";
import { PS_DEMO_CHANNEL } from "../lib/utils";

const rawUrl = process.env.DATABASE_URL ?? "";
const wantsSsl =
  process.env.DATABASE_SSL === "true" ||
  /sslmode=(require|verify-ca|verify-full)/i.test(rawUrl);

const pool = new Pool({
  connectionString: rawUrl.replace(/[?&]sslmode=[^&]+/i, "").replace(/\?$/, ""),
  max: 1,
  connectionTimeoutMillis: 30_000,
  ssl: wantsSsl ? { rejectUnauthorized: false } : false,
});

const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const logoUrl = "/icons/icon-192.png";
  const existing =
    (await prisma.channel.findUnique({
      where: { externalId: PS_DEMO_CHANNEL.externalId },
    })) ||
    (await prisma.channel.findUnique({ where: { slug: PS_DEMO_CHANNEL.slug } }));

  const data = {
    name: PS_DEMO_CHANNEL.name,
    slug: PS_DEMO_CHANNEL.slug,
    streamUrl: PS_DEMO_CHANNEL.streamUrl,
    logoUrl,
    country: "LK",
    countryName: "Sri Lanka",
    language: "en",
    category: "Education",
    isLocal: true,
    isPremium: false,
    isHidden: false,
    isBroken: false,
    externalId: PS_DEMO_CHANNEL.externalId,
    sortOrder: -1000,
  };

  if (existing) {
    await prisma.channel.update({ where: { id: existing.id }, data });
    console.log("Updated PS Demo TV:", existing.id);
  } else {
    const created = await prisma.channel.create({ data });
    console.log("Created PS Demo TV:", created.id);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
