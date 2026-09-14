import { prisma } from "./client";

/** All exchange rates on record — small table, safe to load in full for MVP. */
export async function listExchangeRates() {
  return prisma.exchangeRate.findMany({ orderBy: { date: "asc" } });
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
