import { listSecurities } from "@/lib/db/securities";
import { getEarliestTransactionDateForSecurity } from "@/lib/db/transactions";
import { getEarliestPriceDate, upsertPrice } from "@/lib/db/prices";
import { listWatchedSecurityIds } from "@/lib/db/watchlist";
import { getFinancialDataProvider, ProviderError } from "@/lib/providers/financialData";

export interface PriceHistorySyncSummary {
  provider: string;
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ ticker: string; message: string }>;
}

const DAY_MS = 86_400_000;
/** Fetch a bit earlier than the date we actually need — a nearest-prior-date
 * lookup (see `portfolioValueHistoryService.ts`) has nothing to find if the
 * cached series starts exactly on the first date it's ever queried for, and
 * that date wasn't a trading day (weekend/holiday). */
const LOOKBACK_PADDING_DAYS = 10;
/** A watchlist-only security has no transaction to anchor a backfill to —
 * it just needs enough recent history for "day-over-day change" (see
 * getPreviousClosePrices) and for the watchlist price chart's SMA 100 /
 * Fibonacci retracement (see securityChartService.ts) to have a full
 * year of chart to actually show once the SMA 100 catches up, so fall
 * back to a fixed window rather than skipping it entirely. */
const WATCHLIST_LOOKBACK_DAYS = 500;

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
 * Also covers securities that are only on a watchlist (no transactions at
 * all) — otherwise their day-over-day change on the Watchlist page has
 * nothing to compare against and permanently shows "—".
 *
 * A security with neither a transaction nor a watchlist entry is skipped
 * — there's nothing to reconstruct history for. With the default `manual`
 * provider this is a no-op, same as `refreshAllPrices`.
 */
export async function syncPriceHistory(): Promise<PriceHistorySyncSummary> {
  const provider = getFinancialDataProvider();
  const [securities, watchedSecurityIds] = await Promise.all([
    listSecurities(),
    listWatchedSecurityIds(),
  ]);
  const watchedSet = new Set(watchedSecurityIds);

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ ticker: string; message: string }> = [];
  const today = new Date();

  for (const security of securities) {
    const earliestTransactionDate = await getEarliestTransactionDateForSecurity(security.id);
    const earliestNeeded =
      earliestTransactionDate ??
      (watchedSet.has(security.id)
        ? new Date(today.getTime() - WATCHLIST_LOOKBACK_DAYS * DAY_MS)
        : null);
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
        new Date(earliestNeeded.getTime() - LOOKBACK_PADDING_DAYS * DAY_MS),
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
