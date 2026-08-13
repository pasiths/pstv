import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const caCert = process.env.DATABASE_CA?.replace(/\\n/g, "\n");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 30_000,
    ssl: caCert
      ? {
          rejectUnauthorized: true,
          ca: caCert,
        }
      : process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : false,
  });

const adapter = new PrismaPg(pool);
const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

export { prisma };
