"use server";

import { prisma } from "@/lib/prisma";
import { isSyntheticPsDemoChannelId } from "@/lib/ps-demo";
import { getCurrentUser } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function toggleFavorite(channelId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Login required." };
  // Synthetic PS Demo TV is not a DB row until seeded.
  if (isSyntheticPsDemoChannelId(channelId)) {
    return { success: false, error: "Demo channel cannot be favorited yet." };
  }

  const existing = await prisma.favorite.findUnique({
    where: {
      userId_channelId: { userId: user.id, channelId },
    },
  });

  if (existing) {
    await prisma.favorite.delete({ where: { id: existing.id } });
  } else {
    await prisma.favorite.create({
      data: { userId: user.id, channelId },
    });
  }

  revalidatePath("/");
  revalidatePath("/favorites");
  return { success: true, favorited: !existing };
}

export async function recordWatch(channelId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false };
  // Avoid FK errors when the injected demo channel is not in the DB.
  if (isSyntheticPsDemoChannelId(channelId)) {
    return { success: true, skipped: true };
  }

  const channel = await prisma.channel.findUnique({
    where: { id: channelId },
    select: { id: true },
  });
  if (!channel) return { success: false };

  await prisma.watchHistory.upsert({
    where: {
      userId_channelId: { userId: user.id, channelId },
    },
    create: { userId: user.id, channelId },
    update: { watchedAt: new Date() },
  });

  revalidatePath("/");
  return { success: true };
}
