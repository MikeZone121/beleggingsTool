import { prisma } from "./client";

/** All exchange rates on record — small table, safe to load in full for MVP. */
export async function listExchangeRates() {
  return prisma.exchangeRate.findMany({ orderBy: { date: "asc" } });
}

/** Earliest date this pair has a rate for, or null if it has none yet —
 * used to decide whether a historical backfill is needed before trusting
 * `findFxRate`'s nearest-prior-date lookup for old transactions. */
export async function getEarliestExchangeRateDate(
  baseCurrency: string,
  quoteCurrency: string
): Promise<Date | null> {
  const row = await prisma.exchangeRate.findFirst({
    where: { baseCurrency, quoteCurrency },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return row?.date ?? null;
}

export async function upsertExchangeRate(data: {
  baseCurrency: string;
  quoteCurrency: string;
  date: Date;
  rate: string;
  source: string;
}) {
  return prisma.exchangeRate.upsert({
    where: {
      baseCurrency_quoteCurrency_date: {
        baseCurrency: data.baseCurrency,
        quoteCurrency: data.quoteCurrency,
        date: data.date,
      },
    },
    create: data,
    update: { rate: data.rate, source: data.source },
  });
}
