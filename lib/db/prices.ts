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

/** Each security's most recent close strictly before `asOf`'s calendar
 * date — i.e. "yesterday's close" for day-over-day change, regardless of
 * which market (EU/US/CA) the security trades on, since each `Price.date`
 * already reflects that market's own trading calendar. */
export async function getPreviousClosePrices(
  securityIds: string[],
  asOf: Date
): Promise<Map<string, string>> {
  if (securityIds.length === 0) return new Map();
  const today = new Date(Date.UTC(asOf.getUTCFullYear(), asOf.getUTCMonth(), asOf.getUTCDate()));
  const rows = await prisma.price.findMany({
    where: { securityId: { in: securityIds }, date: { lt: today } },
    orderBy: { date: "desc" },
    select: { securityId: true, close: true },
  });
  const result = new Map<string, string>();
  for (const row of rows) {
    if (!result.has(row.securityId)) result.set(row.securityId, row.close.toString());
  }
  return result;
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
