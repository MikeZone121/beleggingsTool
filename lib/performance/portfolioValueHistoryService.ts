import Decimal from "decimal.js";
import { listTransactionsForPortfolio } from "@/lib/db/transactions";
import { getSecuritiesByIds } from "@/lib/db/securities";
import { listExchangeRates } from "@/lib/db/exchangeRates";
import { listPricesForSecurities } from "@/lib/db/prices";
import { getPortfolioById } from "@/lib/db/portfolios";
import { toDomainTransaction, toSecurityMeta, toFxRate } from "@/lib/db/mappers";
import { deriveHoldings } from "@/lib/finance/holdings";
import { calculateCashBalance } from "@/lib/finance/cashBalance";
import { calculatePortfolioValue } from "@/lib/finance/portfolioValue";
import type { CurrentPrice } from "@/types/domain";

export interface ValuePoint {
  date: Date;
  valueBase: Decimal;
}

const DAY_MS = 86_400_000;

interface PriceSeriesPoint {
  date: Date;
  close: Decimal;
  currency: string;
}

/** Latest entry in a date-ascending series with `date <= target`, or null
 * before the series starts — the same "nearest prior date" rule
 * `findFxRate` uses, just for a plain price series instead of FX rates. */
function nearestOnOrBefore<T extends { date: Date }>(series: T[], target: Date): T | null {
  let result: T | null = null;
  for (const point of series) {
    if (point.date.getTime() > target.getTime()) break;
    result = point;
  }
  return result;
}

/** Evenly spaced sample dates from `start` to `end` inclusive, capped at
 * `maxPoints` — dense enough for a smooth chart without replaying holdings
 * at every single day for a multi-year history. */
function buildSampleDates(start: Date, end: Date, maxPoints: number): Date[] {
  const totalMs = end.getTime() - start.getTime();
  if (totalMs <= 0) return [end];

  const stepMs = Math.max(totalMs / (maxPoints - 1), DAY_MS);
  const dates: Date[] = [];
  for (let t = start.getTime(); t < end.getTime(); t += stepMs) {
    dates.push(new Date(t));
  }
  dates.push(end);
  return dates;
}

/**
 * Reconstructs total portfolio value (holdings + cash, base currency) at a
 * series of past dates by replaying transactions and cached historical
 * prices/FX rates up to each date — the daily valuation history the
 * Analytics page's methodology note has, until now, said the app doesn't
 * compute (see `getPerformanceSnapshot`). Feeds the benchmark comparison
 * chart; a true time-weighted return could reuse this too.
 *
 * Reuses `deriveHoldings`/`calculateCashBalance`/`calculatePortfolioValue`
 * exactly as the live snapshot does — the only difference is that the
 * transaction list and the "current" price/FX lookups are each cut off at
 * the sample date instead of "now". Requires `Price` rows to already be
 * backfilled (see `priceHistorySyncService.ts`) — a security with no
 * cached price before a given sample date simply contributes 0 to that
 * point, same as a live snapshot with `missingFx`.
 */
export async function getPortfolioValueHistory(
  userId: string,
  portfolioId: string,
  maxPoints = 52
): Promise<ValuePoint[]> {
  const portfolio = await getPortfolioById(userId, portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  const transactionRows = await listTransactionsForPortfolio(userId, portfolioId);
  const transactions = transactionRows.map(toDomainTransaction);
  if (transactions.length === 0) return [];

  const securityIds = Array.from(
    new Set(transactions.map((t) => t.securityId).filter((id): id is string => id !== null))
  );
  const securityRows = await getSecuritiesByIds(securityIds);
  const securities = securityRows.map(toSecurityMeta);

  const priceRows = await listPricesForSecurities(securityIds);
  const pricesBySecurity = new Map<string, PriceSeriesPoint[]>();
  for (const row of priceRows) {
    const list = pricesBySecurity.get(row.securityId) ?? [];
    list.push({ date: row.date, close: new Decimal(row.close.toString()), currency: row.currency });
    pricesBySecurity.set(row.securityId, list);
  }

  const fxRateRows = await listExchangeRates();
  const fxRates = fxRateRows.map(toFxRate);

  const earliestDate = transactions[0].date;
  const today = new Date();
  const sampleDates = buildSampleDates(earliestDate, today, maxPoints);

  const points: ValuePoint[] = [];
  for (const sampleDate of sampleDates) {
    const transactionsToDate = transactions.filter((t) => t.date.getTime() <= sampleDate.getTime());
    if (transactionsToDate.length === 0) continue;

    const currentPrices = new Map<string, CurrentPrice>();
    for (const security of securities) {
      const priceAsOf = nearestOnOrBefore(pricesBySecurity.get(security.id) ?? [], sampleDate);
      if (priceAsOf) {
        currentPrices.set(security.id, {
          securityId: security.id,
          price: priceAsOf.close,
          currency: priceAsOf.currency,
          asOf: sampleDate,
        });
      }
    }

    const holdings = deriveHoldings(
      transactionsToDate,
      securities,
      currentPrices,
      fxRates,
      portfolio.baseCurrency
    );
    const cash = calculateCashBalance(transactionsToDate, {
      baseCurrency: portfolio.baseCurrency,
      fxRates,
    });
    const valueBase = calculatePortfolioValue(holdings, [cash.balanceBase]);
    points.push({ date: sampleDate, valueBase });
  }

  return points;
}
