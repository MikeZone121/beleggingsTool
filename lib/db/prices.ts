import { prisma } from "./client";

export async function listPricesForSecurities(securityIds: string[]) {
  if (securityIds.length === 0) return [];
  return prisma.price.findMany({
    where: { securityId: { in: securityIds } },
    orderBy: { date: "asc" },
  });
}

export async function getEarliestPriceDate(securityId: string): Promise<Date | null> {
  const row = await prisma.price.findFirst({
    where: { securityId },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return row?.date ?? null;
}

export async function upsertPrice(data: {
  securityId: string;
  date: Date;
  open: string | null;
  high: string | null;
  low: string | null;
  close: string;
  currency: string;
}) {
  return prisma.price.upsert({
    where: { securityId_date: { securityId: data.securityId, date: data.date } },
    create: data,
    update: {
      open: data.open,
      high: data.high,
      low: data.low,
      close: data.close,
      currency: data.currency,
    },
  });
}
