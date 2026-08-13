import { prisma } from "@/lib/prisma";

export type ChannelCatalogStats = {
  total: number;
  localCount: number;
  freeCount: number;
  paidCount: number;
};

/** One round-trip instead of 4× count() — kinder to small Aiven plans. */
export async function getChannelCatalogStats(): Promise<ChannelCatalogStats> {
  const rows = await prisma.$queryRaw<
    Array<{
      total: number;
      local_count: number;
      free_count: number;
      paid_count: number;
    }>
  >`
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE is_local)::int AS local_count,
      COUNT(*) FILTER (WHERE NOT is_premium)::int AS free_count,
      COUNT(*) FILTER (WHERE is_premium)::int AS paid_count
    FROM channel
    WHERE NOT is_hidden
  `;

  const row = rows[0];
  return {
    total: row?.total ?? 0,
    localCount: row?.local_count ?? 0,
    freeCount: row?.free_count ?? 0,
    paidCount: row?.paid_count ?? 0,
  };
}
