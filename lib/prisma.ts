import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

type PgSsl = boolean | { rejectUnauthorized: boolean; ca?: string };

function resolveSsl(connectionString: string | undefined): PgSsl {
  const caCert = process.env.DATABASE_CA?.replace(/\\n/g, "\n").trim();
  const url = connectionString ?? "";
  const urlWantsSsl =
    /(?:[?&]sslmode=(?:require|verify-ca|verify-full|prefer)|[?&]ssl=true)/i.test(url);
  const flag = process.env.DATABASE_SSL;
  const verify = process.env.DATABASE_SSL_VERIFY === "true";

  if (flag === "false" && !urlWantsSsl) {
    return false;
  }

  if (flag === "true" || urlWantsSsl || caCert) {
    if (verify && caCert) {
      return { rejectUnauthorized: true, ca: caCert };
    }
    return { rejectUnauthorized: false };
  }

  return false;
}

/** Drop sslmode from the URL so Pool `ssl` is the single source of truth. */
function poolConnectionString(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    const matched = raw.match(/^(postgres(?:ql)?:\/\/[^?]+)(\?.*)?$/i);
    if (!matched) return raw;
    const base = matched[1];
    const query = matched[2]?.slice(1);
    if (!query) return raw;
    const params = new URLSearchParams(query);
    params.delete("sslmode");
    const next = params.toString();
    return next ? `${base}?${next}` : base;
  } catch {
    return raw;
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pool: Pool | undefined;
};

/** Prefer Aiven/Neon pooler URL in production when set. */
const rawUrl =
  process.env.DATABASE_POOL_URL ||
  process.env.DATABASE_URL;

const ssl = resolveSsl(rawUrl);
const isServerless =
  process.env.VERCEL === "1" || Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

// Vercel: many concurrent lambdas × pool size = connection exhaustion on Aiven.
// Keep max at 1 per isolate unless explicitly overridden.
const poolMax = Number(
  process.env.DATABASE_POOL_MAX ?? (isServerless ? 1 : 5),
);

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: ssl ? poolConnectionString(rawUrl) : rawUrl,
    max: Number.isFinite(poolMax) && poolMax > 0 ? poolMax : 1,
    // Release idle clients quickly so slots return to Aiven.
    idleTimeoutMillis: isServerless ? 5_000 : 20_000,
    connectionTimeoutMillis: 15_000,
    allowExitOnIdle: true,
    ssl,
  });

const adapter = new PrismaPg(pool);
const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

// Always reuse across warm serverless invocations (not only in development).
globalForPrisma.prisma = prisma;
globalForPrisma.pool = pool;

export { prisma };
