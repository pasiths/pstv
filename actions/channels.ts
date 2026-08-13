"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { hasPermission } from "@/lib/permissions";
import { generateSlug } from "@/lib/utils";
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

export async function checkBrokenLinks(): Promise<ActionResult & { broken?: number }> {
  try {
    await requireChannelPermission("channels-index");
    const channels = await prisma.channel.findMany({
      where: { isHidden: false },
      select: { id: true, streamUrl: true },
    });

    let broken = 0;
    for (const channel of channels) {
      let isBroken = false;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(channel.streamUrl, {
          method: "GET",
          signal: controller.signal,
          headers: { Range: "bytes=0-64" },
        });
        clearTimeout(timeout);
        isBroken = !(res.ok || res.status === 206);
      } catch {
        isBroken = true;
      }

      await prisma.channel.update({
        where: { id: channel.id },
        data: { isBroken, lastCheckedAt: new Date() },
      });
      if (isBroken) broken += 1;
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/channels");
    return { success: true, broken };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Link check failed." };
  }
}
