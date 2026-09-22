import { listWatchlist } from "@/lib/db/watchlist";
import { warmWatchlistSecurity } from "./watchlistWarmupService";
import { getFinancialDataProvider } from "@/lib/providers/financialData";

export interface WatchlistRefreshSummary {
  provider: string;
  /** Tickers whose current price was re-fetched. */
  pricesUpdated: number;
  /** Tickers whose daily-close history moved forward (0 when every series
   * was already current — the same "nothing to do" case as a skip). */
  historyUpdated: number;
  failed: number;
  errors: Array<{ ticker: string; message: string }>;
}

/**
 * Re-fetches the current price *and* the daily-close history of every
 * ticker on a user's watchlist.
 *
 * Both halves are needed, and that's the whole point of this existing
 * separately from "Refresh Prices": a watched ticker's price came from
 * `Security.currentPrice`, but its chart, SMAs and day-over-day change all
 * read `Price` rows, so refreshing only one of the two leaves the page
 * looking half-stuck.
 *
 * Per-security work is delegated to `warmWatchlistSecurity` — refreshing a
 * watched ticker is exactly the same work as warming a newly added one,
 * and it never throws, so one dead ticker can't abort the rest of the run.
 */
export async function refreshWatchlistMarketData(
  userId: string
): Promise<WatchlistRefreshSummary> {
  const items = await listWatchlist(userId);

  let pricesUpdated = 0;
  let historyUpdated = 0;
  let failed = 0;
  const errors: Array<{ ticker: string; message: string }> = [];

  // Sequential, like every other provider loop in this app, to stay inside
  // the rate limit rather than bursting one request per watched ticker.
  for (const item of items) {
    const result = await warmWatchlistSecurity(item.securityId);
    if (result.error !== null) {
      failed += 1;
      errors.push({ ticker: item.security.ticker, message: result.error });
      continue;
    }
    if (result.priceUpdated) pricesUpdated += 1;
    if (result.historyUpdated) historyUpdated += 1;
  }

  return {
    provider: getFinancialDataProvider().name,
    pricesUpdated,
    historyUpdated,
    failed,
    errors,
  };
}
