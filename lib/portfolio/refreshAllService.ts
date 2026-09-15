import { refreshAllPrices } from "./priceRefreshService";
import { syncPriceHistory } from "./priceHistorySyncService";

export interface RefreshAllSummary {
  provider: string;
  prices: { updated: number; failed: number; skipped: number };
  priceHistory: { updated: number; failed: number; skipped: number };
  /** Every individual failure across both steps, prefixed with which step
   * it came from — the separate buttons this replaces each show their own
   * errors in detail; this summary keeps that detail instead of
   * flattening it into just a count. */
  errors: Array<{ step: string; ticker: string; message: string }>;
}

/**
 * The single-click counterpart to the "Refresh Prices" (Portfolio) and
 * "Sync Price History" (Analytics) buttons — a user clicking only one of
 * them (most naturally "Refresh Prices", since that's the most visible
 * one) can end up looking at a portfolio value that seems stuck even
 * right after a "refresh", because the other wasn't run. This runs both
 * in one action: current prices (which already includes FX rates — see
 * `priceRefreshService.ts`) and historical prices (for the benchmark
 * chart/drawdown/day-change coloring).
 *
 * Deliberately excludes dividend history/transactions — those don't
 * change intraday, and are already kept current by the daily
 * `/api/cron/sync-dividends` job, so re-running them on every click would
 * just burn provider rate limit for no new data.
 *
 * Runs sequentially, not in parallel — same rate-limit-friendly reasoning
 * as each individual step already follows.
 */
export async function refreshAllMarketData(): Promise<RefreshAllSummary> {
  const priceSummary = await refreshAllPrices();
  const priceHistorySummary = await syncPriceHistory();

  const errors: RefreshAllSummary["errors"] = [
    ...priceSummary.errors.map((e) => ({ step: "Prices", ticker: e.ticker, message: e.message })),
    ...priceHistorySummary.errors.map((e) => ({
      step: "Price history",
      ticker: e.ticker,
      message: e.message,
    })),
  ];

  return {
    provider: priceSummary.provider,
    prices: {
      updated: priceSummary.updated,
      failed: priceSummary.failed,
      skipped: priceSummary.skipped,
    },
    priceHistory: {
      updated: priceHistorySummary.updated,
      failed: priceHistorySummary.failed,
      skipped: priceHistorySummary.skipped,
    },
    errors,
  };
}
