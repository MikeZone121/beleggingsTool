import { prisma } from "./client";

export async function listWatchlist(userId: string) {
  return prisma.watchlistItem.findMany({
    where: { userId },
    include: { security: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function addToWatchlist(userId: string, securityId: string, notes?: string | null) {
  return prisma.watchlistItem.upsert({
    where: { userId_securityId: { userId, securityId } },
    create: { userId, securityId, notes: notes ?? null },
    update: {},
  });
}

export async function removeFromWatchlist(userId: string, id: string) {
  return prisma.watchlistItem.deleteMany({ where: { id, userId } });
}

/** `targetPrice: null` clears the alert. */
export async function setWatchlistTargetPrice(
  userId: string,
  id: string,
  targetPrice: string | null
) {
  return prisma.watchlistItem.updateMany({
    where: { id, userId },
    data: { targetPrice },
  });
}
