import { PS_DEMO_CHANNEL } from "@/lib/utils";

/** Stable client-only id when the demo row is not yet in the database. */
export const PS_DEMO_SYNTHETIC_ID = "pstv-ps-demo-tv";

export function isSyntheticPsDemoChannelId(channelId: string): boolean {
  return channelId === PS_DEMO_SYNTHETIC_ID;
}

/** Fallback channel shown first for every visitor (public + signed-in). */
export function buildPsDemoChannelCard<T extends Record<string, unknown>>(
  base?: Partial<T>,
) {
  return {
    id: PS_DEMO_SYNTHETIC_ID,
    name: PS_DEMO_CHANNEL.name,
    slug: PS_DEMO_CHANNEL.slug,
    logoUrl: "/icons/icon-192.png",
    category: "Education",
    country: "LK",
    countryName: "Sri Lanka",
    language: "en",
    isLocal: true,
    isPremium: false,
    locked: false,
    isBroken: false,
    streamUrl: PS_DEMO_CHANNEL.streamUrl,
    ...base,
  };
}

export function withPsDemoFirst<
  T extends { name?: string; slug?: string; streamUrl?: string },
>(channels: T[]): T[] {
  const idx = channels.findIndex(
    (c) =>
      c.slug === PS_DEMO_CHANNEL.slug ||
      c.streamUrl === PS_DEMO_CHANNEL.streamUrl ||
      c.name === PS_DEMO_CHANNEL.name,
  );
  if (idx === 0) return channels;
  if (idx > 0) {
    const copy = [...channels];
    const [demo] = copy.splice(idx, 1);
    return [demo, ...copy];
  }
  return [buildPsDemoChannelCard() as unknown as T, ...channels];
}
