import { prisma } from "./client";

export async function listDividendsForSecurities(securityIds: string[]) {
  if (securityIds.length === 0) return [];
  return prisma.dividend.findMany({
    where: { securityId: { in: securityIds } },
    orderBy: { exDividendDate: "asc" },
  });
}

/**
 * The `Dividend` model has no unique constraint on (securityId,
 * exDividendDate) — find-then-write instead of `upsert`, so a repeated
 * sync updates the same row rather than creating a duplicate.
 */
export async function upsertDividendEvent(data: {
  securityId: string;
  exDividendDate: Date;
  dividendPerShare: string;
  currency: string;
  source: string;
}) {
  const existing = await prisma.dividend.findFirst({
    where: { securityId: data.securityId, exDividendDate: data.exDividendDate },
    select: { id: true },
  });

  if (existing) {
    return prisma.dividend.update({
      where: { id: existing.id },
      data: {
        dividendPerShare: data.dividendPerShare,
        currency: data.currency,
        source: data.source,
        status: "PAID",
      },
    });
  }

  return prisma.dividend.create({
    data: {
      securityId: data.securityId,
      exDividendDate: data.exDividendDate,
      dividendPerShare: data.dividendPerShare,
      currency: data.currency,
      source: data.source,
      status: "PAID",
    },
  });
}
