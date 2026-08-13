"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { generateSlug } from "@/lib/utils";
import { repairStreamUrl } from "@/lib/stream-health";
import { revalidatePath } from "next/cache";

export type ChannelInput = {
  name: string;
  streamUrl: string;
  logoUrl?: string;
  country?: string;
  countryName?: string;
  language?: string;
  category?: string;
  isLocal?: boolean;
  isPremium?: boolean;
  isHidden?: boolean;
};

export type ActionResult = {
  success: boolean;
  error?: string;
  id?: string;
};

async function requireChannelPermission(...slugs: string[]) {
  const user = await getCurrentUser();
  if (!user || !hasPermission(user, ...slugs)) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function createChannel(input: ChannelInput): Promise<ActionResult> {
  try {
    await requireChannelPermission("channels-create", "channels-index");
    const name = input.name.trim();
    if (!name || !input.streamUrl.trim()) {
      return { success: false, error: "Name and stream URL are required." };
    }

    let slug = generateSlug(name);
    const existing = await prisma.channel.findUnique({ where: { slug } });
    if (existing) slug = `${slug}-${Date.now().toString(36)}`;

    const channel = await prisma.channel.create({
      data: {
        name,
        slug,
        streamUrl: input.streamUrl.trim(),
        logoUrl: input.logoUrl?.trim() || null,
        country: input.country?.trim() || "LK",
        countryName: input.countryName?.trim() || null,
        language: input.language?.trim() || null,
        category: input.category?.trim() || "General",
        isLocal: input.isLocal ?? false,
        isPremium: input.isPremium ?? false,
        isHidden: input.isHidden ?? false,
      },
    });

    revalidatePath("/");
    revalidatePath("/dashboard/channels");
    return { success: true, id: channel.id };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to create channel." };
  }
}

export async function updateChannel(
  id: string,
  input: ChannelInput,
): Promise<ActionResult> {
  try {
    await requireChannelPermission("channels-edit", "channels-index");
    await prisma.channel.update({
      where: { id },
      data: {
        name: input.name.trim(),
        streamUrl: input.streamUrl.trim(),
        logoUrl: input.logoUrl?.trim() || null,
        country: input.country?.trim() || "LK",
        countryName: input.countryName?.trim() || null,
        language: input.language?.trim() || null,
        category: input.category?.trim() || "General",
        isLocal: input.isLocal ?? false,
        isPremium: input.isPremium ?? false,
        isHidden: input.isHidden ?? false,
      },
    });
    revalidatePath("/");
    revalidatePath("/dashboard/channels");
    return { success: true, id };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update channel." };
  }
}

export async function deleteChannel(id: string): Promise<ActionResult> {
  try {
    await requireChannelPermission("channels-delete", "channels-index");
    await prisma.channel.delete({ where: { id } });
    revalidatePath("/");
    revalidatePath("/dashboard/channels");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to delete channel." };
  }
}

export async function toggleChannelHidden(id: string): Promise<ActionResult> {
  try {
    await requireChannelPermission("channels-edit", "channels-index");
    const channel = await prisma.channel.findUnique({ where: { id } });
    if (!channel) return { success: false, error: "Channel not found." };
    await prisma.channel.update({
      where: { id },
      data: { isHidden: !channel.isHidden },
    });
    revalidatePath("/");
    revalidatePath("/dashboard/channels");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to update channel." };
  }
}

/**
 * Probe visible channels, auto-swap dead URLs with working iptv-org alternates,
 * and mark remaining failures as broken (Not working).
 */
export async function checkBrokenLinks(): Promise<
  ActionResult & { broken?: number; repaired?: number; checked?: number }
> {
  try {
    await requireChannelPermission("channels-index");

    // Prefer stale / never-checked first; cap per run so the request can finish.
    const channels = await prisma.channel.findMany({
      where: { isHidden: false },
      select: {
        id: true,
        streamUrl: true,
        externalId: true,
        lastCheckedAt: true,
      },
      orderBy: [{ lastCheckedAt: "asc" }, { updatedAt: "asc" }],
      take: 120,
    });

    let broken = 0;
    let repaired = 0;

    for (const channel of channels) {
      const result = await repairStreamUrl({
        streamUrl: channel.streamUrl,
        externalId: channel.externalId,
      });

      await prisma.channel.update({
        where: { id: channel.id },
        data: {
          streamUrl: result.url,
          isBroken: !result.working,
          lastCheckedAt: new Date(),
        },
      });

      if (result.repaired) repaired += 1;
      if (!result.working) broken += 1;
    }

    revalidatePath("/");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/channels");
    return {
      success: true,
      checked: channels.length,
      broken,
      repaired,
    };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Link check failed." };
  }
}

/** Mark a batch of international Sports/Movies as Paid (locked) for freemium. */
export async function tagPremiumSamples(
  limit = 80,
): Promise<ActionResult & { tagged?: number }> {
  try {
    await requireChannelPermission("channels-edit", "channels-index");

    // Keep all local channels free.
    await prisma.channel.updateMany({
      where: { isLocal: true },
      data: { isPremium: false },
    });

    const candidates = await prisma.channel.findMany({
      where: {
        isHidden: false,
        isLocal: false,
        isPremium: false,
        category: { in: ["Sports", "Movies", "Entertainment"] },
      },
      orderBy: { name: "asc" },
      take: limit,
      select: { id: true },
    });

    if (candidates.length) {
      await prisma.channel.updateMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        data: { isPremium: true },
      });
    }

    revalidatePath("/");
    revalidatePath("/dashboard/channels");
    return { success: true, tagged: candidates.length };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Failed to tag premium channels." };
  }
}
