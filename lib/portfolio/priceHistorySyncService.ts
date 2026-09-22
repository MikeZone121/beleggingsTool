import { getSecurityById, listSecurities } from "@/lib/db/securities";
import { getEarliestTransactionDateForSecurity } from "@/lib/db/transactions";
import { getEarliestPriceDate, getLatestPriceDate, upsertPrice } from "@/lib/db/prices";
import { listWatchedSecurityIds } from "@/lib/db/watchlist";
import {
  getFinancialDataProvider,
  ProviderError,
  type FinancialDataProvider,
} from "@/lib/providers/financialData";

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
/** How far back a forward-fill re-fetches. More than the longest weekend or
 * market holiday, so the gap between the last cached close and today is
 * always covered, and wide enough that a close the provider later revises
 * gets overwritten rather than kept forever. */
const FORWARD_FILL_WINDOW_DAYS = 15;

/** Today at UTC midnight — `Price.date` is a date column, so comparing
 * against a timestamp would make "is the series current?" depend on the
 * time of day the check happens to run. */
function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

interface HistoricalSecurity {
  id: string;
  ticker: string;
  exchange: string | null;
}

/**
 * Brings one security's daily closes up to date at both ends: back to
 * `earliestNeeded`, and forward to today. Returns false when the cached
 * series already covers both, true when it wrote.
 *
 * Checking *both* ends matters. This used to check only the earliest
 * cached date, which made every later sync a no-op the moment the series
 * reached far enough back — so a watchlist ticker's chart, its SMAs and
 * its day-over-day change silently froze on the day it was added, no
 * matter how often prices were refreshed afterwards (`Security.currentPrice`
 * kept updating, the `Price` rows behind the chart did not).
 */
async function syncSecurityHistory(
  provider: FinancialDataProvider,
  security: HistoricalSecurity,
  earliestNeeded: Date,
  today: Date
): Promise<boolean> {
  const [earliestOnRecord, latestOnRecord] = await Promise.all([
    getEarliestPriceDate(security.id),
    getLatestPriceDate(security.id),
  ]);
  const needsBackfill = !earliestOnRecord || earliestOnRecord > earliestNeeded;
  const needsForwardFill = !latestOnRecord || latestOnRecord < startOfUtcDay(today);
  if (!needsBackfill && !needsForwardFill) return false;

  // A backfill has to re-fetch the whole range anyway (it ends at today);
  // a series that only lost its forward edge just needs the recent window.
  const from = needsBackfill
    ? new Date(earliestNeeded.getTime() - LOOKBACK_PADDING_DAYS * DAY_MS)
    : new Date(latestOnRecord!.getTime() - FORWARD_FILL_WINDOW_DAYS * DAY_MS);

  const points = await provider.getHistoricalPrices(
    security.ticker,
    from,
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
  return true;
}

/**
 * Syncs the `WATCHLIST_LOOKBACK_DAYS` window for a single security — for
 * the moment one is added to a watchlist (until this runs it has no `Price`
 * rows at all, so its chart, SMAs, Fibonacci levels and day-over-day
 * change are empty), and for every later refresh of that watchlist, which
 * extends the same window forward to today.
 */
export async function syncPriceHistoryForSecurity(securityId: string): Promise<boolean> {
  const security = await getSecurityById(securityId);
  if (!security) return false;

  const today = new Date();
  const earliestTransactionDate = await getEarliestTransactionDateForSecurity(security.id);
  const earliestNeeded =
    earliestTransactionDate ?? new Date(today.getTime() - WATCHLIST_LOOKBACK_DAYS * DAY_MS);

  return syncSecurityHistory(getFinancialDataProvider(), security, earliestNeeded, today);
}

/**
 * Backfills the `Price` table (unused until now) with each traded
 * security's daily close history, back to that security's own first
 * transaction — this is what the benchmark chart (see
 * `lib/performance/portfolioValueHistoryService.ts`) replays to reconstruct
 * portfolio value at past dates, since `Security.currentPrice` only ever
 * holds today's price. Same "check coverage, fetch only the gap" pattern as
 * `refreshExchangeRates`, so this stays cheap after the first run: once a
 * series is current, every security is skipped without a request.
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

    try {
      if (await syncSecurityHistory(provider, security, earliestNeeded, today)) {
        updated += 1;
      } else {
        skipped += 1;
      }
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
