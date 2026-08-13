import {
  extractProgrammesForChannelName,
  fetchHiruTvSchedule,
  isHiruChannel,
  loadEpgPwCountryXml,
  type ParsedProgramme,
} from "@/lib/epg-sources";
import type { ProgramSlot } from "@/lib/epg";
import { prisma } from "@/lib/prisma";

const STALE_MS = 8 * 60 * 60 * 1000;

function toSlots(rows: ParsedProgramme[]): ProgramSlot[] {
  return rows
    .slice()
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .map((p) => ({
      title: p.title,
      description: p.description,
      startsAt: p.startsAt.toISOString(),
      endsAt: p.endsAt.toISOString(),
      generated: false,
    }));
}

async function replaceChannelEpg(channelId: string, programmes: ParsedProgramme[]) {
  if (!programmes.length) return;
  const minStart = programmes.reduce(
    (m, p) => (p.startsAt < m ? p.startsAt : m),
    programmes[0].startsAt,
  );
  const maxEnd = programmes.reduce(
    (m, p) => (p.endsAt > m ? p.endsAt : m),
    programmes[0].endsAt,
  );

  await prisma.$transaction([
    prisma.epgEntry.deleteMany({
      where: {
        channelId,
        startsAt: { lt: maxEnd },
        endsAt: { gt: minStart },
      },
    }),
    prisma.epgEntry.createMany({
      data: programmes.map((p) => ({
        channelId,
        title: p.title.slice(0, 240),
        description: p.description,
        startsAt: p.startsAt,
        endsAt: p.endsAt,
      })),
    }),
  ]);
}

async function fetchLiveProgrammes(channel: {
  id: string;
  name: string;
  country: string;
  externalId: string | null;
}): Promise<ParsedProgramme[]> {
  if (isHiruChannel(channel)) {
    const today = await fetchHiruTvSchedule(new Date());
    const tomorrow = await fetchHiruTvSchedule(
      new Date(Date.now() + 24 * 60 * 60 * 1000),
    );
    return [...today, ...tomorrow];
  }

  if (!channel.country || channel.country === "XX") return [];
  const xml = await loadEpgPwCountryXml(channel.country);
  if (!xml) return [];
  return extractProgrammesForChannelName(xml, channel.name);
}

/**
 * Return real programme slots for a channel.
 * Uses DB cache when fresh; otherwise fetches Hiru official JSON or epg.pw.
 * Never invents fake titles.
 */
export async function resolveRealProgrammes(channelId: string): Promise<{
  programs: ProgramSlot[];
  source: "database" | "live" | "none";
  channelName: string;
  category: string;
}> {
  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: {
      id: true,
      name: true,
      category: true,
      country: true,
      externalId: true,
    },
  });
  if (!channel) {
    return { programs: [], source: "none", channelName: "", category: "General" };
  }

  const now = Date.now();
  // Keep a little past context for "now" detection, but UI starts from current.
  const windowStart = new Date(now - 30 * 60 * 1000);
  const windowEnd = new Date(now + 36 * 60 * 60 * 1000);

  const stored = await prisma.epgEntry.findMany({
    where: {
      channelId,
      startsAt: { lt: windowEnd },
      endsAt: { gt: windowStart },
    },
    orderBy: { startsAt: "asc" },
  });

  const mapStored = (rows: typeof stored): ProgramSlot[] => {
    const sorted = rows
      .map((e) => ({
        title: e.title,
        description: e.description,
        startsAt: e.startsAt.toISOString(),
        endsAt: e.endsAt.toISOString(),
        generated: false as const,
      }))
      .sort(
        (a, b) =>
          new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
      );
    // Drop finished programmes — start from what's on now.
    const idx = sorted.findIndex(
      (p) =>
        new Date(p.startsAt).getTime() <= now &&
        new Date(p.endsAt).getTime() > now,
    );
    if (idx >= 0) return sorted.slice(idx);
    return sorted.filter((p) => new Date(p.endsAt).getTime() > now);
  };

  const newest = stored.reduce(
    (m, e) => Math.max(m, e.startsAt.getTime()),
    0,
  );
  const hasCurrent = stored.some(
    (e) => e.startsAt.getTime() <= now && e.endsAt.getTime() > now,
  );
  const fresh =
    stored.length > 0 &&
    hasCurrent &&
    (newest === 0 || now - newest < STALE_MS || stored.length >= 3);

  if (fresh) {
    return {
      programs: mapStored(stored),
      source: "database",
      channelName: channel.name,
      category: channel.category,
    };
  }

  const live = await fetchLiveProgrammes(channel);
  if (live.length) {
    await replaceChannelEpg(channel.id, live);
    const filtered = live.filter(
      (p) =>
        p.endsAt.getTime() > windowStart.getTime() &&
        p.startsAt.getTime() < windowEnd.getTime(),
    );
    const slots = toSlots(filtered.length ? filtered : live);
    const idx = slots.findIndex(
      (p) =>
        new Date(p.startsAt).getTime() <= now &&
        new Date(p.endsAt).getTime() > now,
    );
    return {
      programs:
        idx >= 0
          ? slots.slice(idx)
          : slots.filter((p) => new Date(p.endsAt).getTime() > now),
      source: "live",
      channelName: channel.name,
      category: channel.category,
    };
  }

  // Keep any old stored rows rather than inventing titles.
  if (stored.length) {
    return {
      programs: mapStored(stored),
      source: "database",
      channelName: channel.name,
      category: channel.category,
    };
  }

  return {
    programs: [],
    source: "none",
    channelName: channel.name,
    category: channel.category,
  };
}
