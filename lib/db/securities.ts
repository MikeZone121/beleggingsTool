import { Prisma } from "@/generated/prisma/client";
import { prisma } from "./client";
import type { SecurityInput, SecurityUpdateInput } from "@/lib/validation/security";

export async function listSecurities() {
  return prisma.security.findMany({ orderBy: { ticker: "asc" } });
}

export async function getSecurityById(securityId: string) {
  return prisma.security.findUnique({ where: { id: securityId } });
}

export async function getSecuritiesByIds(securityIds: string[]) {
  if (securityIds.length === 0) return [];
  return prisma.security.findMany({ where: { id: { in: securityIds } } });
}

export async function createSecurity(data: SecurityInput) {
  try {
    return await prisma.security.create({
      data: {
        ticker: data.ticker,
        name: data.name,
        isin: data.isin ?? null,
        assetType: data.assetType,
        exchange: data.exchange ?? null,
        currency: data.currency,
        country: data.country ?? null,
        sector: data.sector ?? null,
        currentPrice: data.currentPrice ?? null,
        priceUpdatedAt: data.currentPrice ? new Date() : null,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(
        `A security with ticker "${data.ticker}" on exchange "${data.exchange ?? "—"}" already exists`
      );
    }
    throw error;
  }
}

/**
 * Partial update of a security's reference data (ticker, name, exchange,
 * currency, …). Separate from `updateSecurityPrice` because that one is a
 * price *observation* — it stamps `priceUpdatedAt` — whereas this is an
 * editorial correction, e.g. a ticker stored without the exchange suffix
 * the provider needs ("BNP" instead of "BNP.PA", see yahooFinance.ts).
 *
 * Only the keys actually present in `data` are written: a PATCH that
 * changes the ticker must not blank out the ISIN the caller never sent.
 */
export async function updateSecurity(securityId: string, data: SecurityUpdateInput) {
  const patch: Prisma.SecurityUpdateInput = {};
  if (data.ticker !== undefined) patch.ticker = data.ticker;
  if (data.name !== undefined) patch.name = data.name;
  if (data.isin !== undefined) patch.isin = data.isin ?? null;
  if (data.assetType !== undefined) patch.assetType = data.assetType;
  if (data.exchange !== undefined) patch.exchange = data.exchange ?? null;
  if (data.currency !== undefined) patch.currency = data.currency;
  if (data.country !== undefined) patch.country = data.country ?? null;
  if (data.sector !== undefined) patch.sector = data.sector ?? null;
  // A *changed* price is a price observation, so it carries the same
  // `priceUpdatedAt` stamp `updateSecurityPrice` writes — otherwise the
  // "stale price" badge would keep flagging a value just entered. An
  // unchanged one must not re-stamp: the edit dialog always submits every
  // field, and saving a ticker correction would otherwise pass a
  // week-old price off as fresh.
  if (data.currentPrice !== undefined) {
    const current = await prisma.security.findUnique({
      where: { id: securityId },
      select: { currentPrice: true },
    });
    const unchanged =
      (current?.currentPrice?.toString() ?? null) === (data.currentPrice ?? null);
    if (!unchanged) {
      patch.currentPrice = data.currentPrice ?? null;
      patch.priceUpdatedAt = data.currentPrice ? new Date() : null;
    }
  }

  try {
    return await prisma.security.update({ where: { id: securityId }, data: patch });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(
        `A security with ticker "${data.ticker}" on exchange "${data.exchange ?? "—"}" already exists`
      );
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error("Security not found");
    }
    throw error;
  }
}

/**
 * Deletes a security, refusing while any transaction still references it.
 *
 * The refusal is not a convenience check: `Transaction.securityId` is an
 * *optional* relation, so Prisma's default referential action on delete is
 * SetNull — a transaction would survive with `securityId: null`, turning a
 * BUY into an untraceable cash movement and silently changing the
 * portfolio's cost basis. Prices, dividends, corporate actions and
 * watchlist rows do cascade (see schema.prisma), which is exactly what
 * should happen: they are observations about the security, not history of
 * what the user did.
 */
export async function deleteSecurity(securityId: string) {
  const transactionCount = await prisma.transaction.count({ where: { securityId } });
  if (transactionCount > 0) {
    throw new Error(
      `This security is used by ${transactionCount} transaction${transactionCount === 1 ? "" : "s"} — delete or reassign those first`
    );
  }

  try {
    return await prisma.security.delete({ where: { id: securityId } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      throw new Error("Security not found");
    }
    throw error;
  }
}

/** Transaction count per security id, for the Securities page (which
 * disables deleting a security that is still in use) — one grouped query
 * rather than a count per row. */
export async function countTransactionsBySecurity(): Promise<Map<string, number>> {
  const grouped = await prisma.transaction.groupBy({
    by: ["securityId"],
    _count: { _all: true },
  });

  const counts = new Map<string, number>();
  for (const row of grouped) {
    if (row.securityId !== null) counts.set(row.securityId, row._count._all);
  }
  return counts;
}

export async function updateSecurityPrice(securityId: string, price: string) {
  return prisma.security.update({
    where: { id: securityId },
    data: { currentPrice: price, priceUpdatedAt: new Date() },
  });
}
