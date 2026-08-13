"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { generateSlug } from "@/lib/utils";
import { revalidatePath } from "next/cache";

type IptvOrgChannel = {
  id?: string;
  name: string;
  logo?: string | null;
  country?: string;
  languages?: string[];
  categories?: string[];
  url?: string;
};

export async function syncInternationalChannels(limit = 200) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, "channels-create", "channels-index")) {
    return { success: false, error: "Unauthorized" };
  }

  try {
    const streamsRes = await fetch(
      "https://iptv-org.github.io/api/streams.json",
      { next: { revalidate: 3600 } },
    );
    const channelsRes = await fetch(
      "https://iptv-org.github.io/api/channels.json",
      { next: { revalidate: 3600 } },
    );

    if (!streamsRes.ok || !channelsRes.ok) {
      return { success: false, error: "Failed to fetch iptv-org API." };
    }

    const streams = (await streamsRes.json()) as Array<{
      channel?: string;
      url: string;
    }>;
    const channels = (await channelsRes.json()) as IptvOrgChannel[];

    const channelById = new Map(channels.map((c) => [c.id, c]));
    const withUrls: Array<IptvOrgChannel & { url: string }> = [];

    for (const stream of streams) {
      if (!stream.channel || !stream.url) continue;
      const meta = channelById.get(stream.channel);
      if (!meta) continue;
      withUrls.push({ ...meta, url: stream.url });
      if (withUrls.length >= limit) break;
    }

    let created = 0;
    for (const item of withUrls) {
      const externalId = item.id ?? generateSlug(item.name);
      const existing = await prisma.channel.findUnique({
        where: { externalId },
      });
      if (existing) continue;

      let slug = generateSlug(item.name || externalId);
      const slugTaken = await prisma.channel.findUnique({ where: { slug } });
      if (slugTaken) slug = `${slug}-${externalId.slice(0, 6)}`;

      await prisma.channel.create({
        data: {
          name: item.name,
          slug,
          streamUrl: item.url,
          logoUrl: item.logo || null,
          country: item.country || "XX",
          countryName: item.country || null,
          language: item.languages?.[0] || null,
          category: item.categories?.[0] || "General",
          isLocal: false,
          externalId,
        },
      });
      created += 1;
    }

    revalidatePath("/");
    revalidatePath("/dashboard/channels");
    return { success: true, created, total: withUrls.length };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Sync failed." };
  }
}
