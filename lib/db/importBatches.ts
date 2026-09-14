import { prisma } from "./client";

export async function createImportBatch(data: {
  accountId: string;
  source: string;
  fileName: string;
  status: string;
  summary: object;
}) {
  return prisma.importBatch.create({ data });
}

export async function listImportBatches(userId: string, portfolioId: string) {
  return prisma.importBatch.findMany({
    where: { account: { portfolio: { id: portfolioId, userId } } },
    orderBy: { createdAt: "desc" },
  });
}
