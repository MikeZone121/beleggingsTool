import { prisma } from "./client";

export async function listPricesForSecurities(securityIds: string[]) {
  if (securityIds.length === 0) return [];
  return prisma.price.findMany({
    where: { securityId: { in: securityIds } },
    orderBy: { date: "asc" },
  });
}

/** Most recent date a security has a close for — the forward edge of the
 * cached series, which is what tells `priceHistorySyncService` whether the
 * history has gone stale rather than just being short at the far end. */
export async function getLatestPriceDate(securityId: string): Promise<Date | null> {
  const row = await prisma.price.findFirst({
    where: { securityId },
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return row?.date ?? null;
}

export async function getEarliestPriceDate(securityId: string): Promise<Date | null> {
  const row = await prisma.price.findFirst({
    where: { securityId },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return row?.date ?? null;
}

/** Each security's close on the trading day *before* its own most recent
 * cached one — i.e. "the previous close", for day-over-day change.
 *
 * Deliberately not "strictly before today's wall-clock date": `Security.
 * currentPrice` is only ever as fresh as the last manual/scheduled refresh,
 * so outside a market's trading hours (pre-market, weekends, a refresh
 * that simply hasn't happened yet today) the live quote and this table's
 * latest cached close are frequently the *same* session's price. Anchoring
 * to "today" then compares that price to itself and reports a day change
 * of exactly 0% — not "unchanged", but "no newer session to compare
 * against yet". Anchoring to each security's own latest cached date
 * instead always compares two distinct sessions, so the change shown is
 * the last real move, whatever today's wall-clock date happens to be.
 */
export async function getPreviousClosePrices(securityIds: string[]): Promise<Map<string, string>> {
  if (securityIds.length === 0) return new Map();
  const rows = await prisma.price.findMany({
    where: { securityId: { in: securityIds } },
    orderBy: { date: "desc" },
    select: { securityId: true, close: true },
  });
  const result = new Map<string, string>();
  const latestSeen = new Set<string>();
  for (const row of rows) {
    if (result.has(row.securityId)) continue;
    // The first row seen per security is its most recent cached close —
    // the one `currentPrice` is being compared against, not the
    // "previous" one — so it's skipped rather than returned.
    if (!latestSeen.has(row.securityId)) {
      latestSeen.add(row.securityId);
      continue;
    }
    result.set(row.securityId, row.close.toString());
  }
  return result;
}

/** Days of slack allowed when resolving "the close on date X": X itself may
 * be a weekend or holiday, and a long market closure still never comes
 * close to this. Bounding the lookback keeps the query from scanning a
 * security's entire price history for one date. */
const CLOSE_LOOKBACK_DAYS = 30;

/** Each security's last close on or before `date` — used for the
 * 31/12/2025 reference value the Belgian capital-gains regime measures
 * pre-2026 positions against (see lib/finance/capitalGainsTax.ts). A
 * security with no cached history that far back is simply absent from the
 * map; callers must not treat that as a zero. */
export async function getClosePricesOnOrBefore(
  securityIds: string[],
  date: Date
): Promise<Map<string, string>> {
  if (securityIds.length === 0) return new Map();
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const start = new Date(end.getTime() - CLOSE_LOOKBACK_DAYS * 86_400_000);
  const rows = await prisma.price.findMany({
    where: { securityId: { in: securityIds }, date: { gte: start, lte: end } },
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
