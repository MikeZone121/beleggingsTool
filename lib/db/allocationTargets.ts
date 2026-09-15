import { prisma } from "./client";

export async function listAllocationTargets(portfolioId: string, dimension: string) {
  return prisma.allocationTarget.findMany({
    where: { portfolioId, dimension },
  });
}

export async function upsertAllocationTarget(data: {
  portfolioId: string;
  dimension: string;
  key: string;
  /** A fraction (0.6 = 60%), not a whole percent — matches `AllocationBucket.weight`. */
  targetPercent: string;
}) {
  return prisma.allocationTarget.upsert({
    where: {
      portfolioId_dimension_key: {
        portfolioId: data.portfolioId,
        dimension: data.dimension,
        key: data.key,
      },
    },
    create: data,
    update: { targetPercent: data.targetPercent },
  });
}

/** Scoped to `portfolioId` so a request can't delete another portfolio's
 * target by guessing its id. */
export async function deleteAllocationTarget(id: string, portfolioId: string) {
  const { count } = await prisma.allocationTarget.deleteMany({ where: { id, portfolioId } });
  if (count === 0) {
    throw new Error("Allocation target not found");
  }
}
