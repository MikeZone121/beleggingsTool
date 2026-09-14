import Decimal from "decimal.js";
import type {
  Transaction as PrismaTransaction,
  Security as PrismaSecurity,
  ExchangeRate as PrismaExchangeRate,
} from "@/generated/prisma/client";
import type { DomainTransaction, CurrentPrice, FxRate } from "@/types/domain";
import type { SecurityMeta } from "@/lib/finance/holdings";

/**
 * Prisma's `Decimal` is a separately-bundled instance of decimal.js, so
 * `instanceof` checks against our own decimal.js import aren't reliable
 * across the boundary. Always re-wrap via `.toString()` when crossing from
 * a Prisma row into a domain type — cheap, and removes any ambiguity.
 */
function toAppDecimal(value: { toString(): string } | null): Decimal | null {
  if (value === null) return null;
  return new Decimal(value.toString());
}

/**
 * Maps a Prisma `Transaction` row (joined with its optional `security`) into
 * the `DomainTransaction` shape the finance layer consumes. `sequence` uses
 * `createdAt` as the deterministic same-day tie-breaker (see
 * lib/finance/costBasis.ts) — this assumes transactions are entered/imported
 * in the order they actually occurred intraday, which holds for manual entry
 * and for CSV imports that preserve source row order.
 */
export function toDomainTransaction(row: PrismaTransaction): DomainTransaction {
  return {
    id: row.id,
    accountId: row.accountId,
    securityId: row.securityId,
    type: row.type,
    date: row.date,
    sequence: row.createdAt.getTime(),
    quantity: toAppDecimal(row.quantity),
    price: toAppDecimal(row.price),
    grossAmount: toAppDecimal(row.grossAmount)!,
    fees: toAppDecimal(row.fees)!,
    taxes: toAppDecimal(row.taxes)!,
    netAmount: toAppDecimal(row.netAmount)!,
    currency: row.currency,
    exchangeRate: toAppDecimal(row.exchangeRate),
  };
}

export function toSecurityMeta(row: PrismaSecurity): SecurityMeta {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    assetType: row.assetType,
    sector: row.sector,
    country: row.country,
    currency: row.currency,
  };
}

export function toFxRate(row: PrismaExchangeRate): FxRate {
  return {
    baseCurrency: row.baseCurrency,
    quoteCurrency: row.quoteCurrency,
    date: row.date,
    rate: toAppDecimal(row.rate)!,
  };
}

export function toCurrentPrice(row: PrismaSecurity): CurrentPrice | null {
  if (row.currentPrice === null || row.priceUpdatedAt === null) return null;
  return {
    securityId: row.id,
    price: toAppDecimal(row.currentPrice)!,
    currency: row.currency,
    asOf: row.priceUpdatedAt,
  };
}
