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
  // Opt-in full cert verify. Wrong/outdated CA otherwise breaks managed DBs (Aiven).
  const verify = process.env.DATABASE_SSL_VERIFY === "true";

  // Local Postgres: DATABASE_SSL=false and no sslmode in the URL
  if (flag === "false" && !urlWantsSsl) {
    return false;
  }

  if (flag === "true" || urlWantsSsl || caCert) {
    if (verify && caCert) {
      return { rejectUnauthorized: true, ca: caCert };
    }
    // TLS on, but allow provider cert chains without a trusted local CA bundle.
    return { rejectUnauthorized: false };
  }

  return false;
}

/** Drop sslmode from the URL so Pool `ssl` is the single source of truth (avoids pg verify-full alias). */
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

const rawUrl = process.env.DATABASE_URL;
const ssl = resolveSsl(rawUrl);

const pool =
  globalForPrisma.pool ??
  new Pool({
    connectionString: ssl ? poolConnectionString(rawUrl) : rawUrl,
    connectionTimeoutMillis: 30_000,
    idleTimeoutMillis: 30_000,
    ssl,
  });

const adapter = new PrismaPg(pool);
const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pool = pool;
}

export { prisma };
