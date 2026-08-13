"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/session";
import { revalidatePath } from "next/cache";

export async function toggleFavorite(channelId: string) {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "Login required." };

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
