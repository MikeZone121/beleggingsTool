import { listSecurities } from "@/lib/db/securities";
import { getEarliestTransactionDateForSecurity } from "@/lib/db/transactions";
import { getEarliestPriceDate, upsertPrice } from "@/lib/db/prices";
import { getFinancialDataProvider, ProviderError } from "@/lib/providers/financialData";

export interface PriceHistorySyncSummary {
  provider: string;
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ ticker: string; message: string }>;
}

/**
 * Backfills the `Price` table (unused until now) with each traded
 * security's daily close history, back to that security's own first
 * transaction — this is what the benchmark chart (see
 * `lib/performance/portfolioValueHistoryService.ts`) replays to reconstruct
 * portfolio value at past dates, since `Security.currentPrice` only ever
 * holds today's price. Same "check coverage, backfill only the gap"
 * pattern as `refreshExchangeRates`, so this stays cheap after the first
 * run.
 *
 * A security with no transactions yet is skipped — there's nothing to
 * reconstruct history for. With the default `manual` provider this is a
 * no-op, same as `refreshAllPrices`.
 */
export async function syncPriceHistory(): Promise<PriceHistorySyncSummary> {
  const provider = getFinancialDataProvider();
  const securities = await listSecurities();

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ ticker: string; message: string }> = [];
  const today = new Date();

  for (const security of securities) {
    const earliestNeeded = await getEarliestTransactionDateForSecurity(security.id);
    if (!earliestNeeded) {
      skipped += 1;
      continue;
    }

    const earliestOnRecord = await getEarliestPriceDate(security.id);
    if (earliestOnRecord && earliestOnRecord <= earliestNeeded) {
      skipped += 1;
      continue;
    }

    try {
      const points = await provider.getHistoricalPrices(
        security.ticker,
        earliestNeeded,
        today,
        security.exchange
      );
      for (const point of points) {
        await upsertPrice({
          securityId: security.id,
          date: point.date,
          open: point.open?.toString() ?? null,
          high: point.high?.toString() ?? null,
          low: point.low?.toString() ?? null,
          close: point.close.toString(),
          currency: point.currency,
        });
      }
      updated += 1;
    } catch (error) {
      failed += 1;
      errors.push({
        ticker: security.ticker,
        message:
          error instanceof ProviderError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unknown error",
      });
    }
  }

  return { provider: provider.name, updated, failed, skipped, errors };
}
