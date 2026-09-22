import { refreshPriceForSecurity } from "./priceRefreshService";
import { syncPriceHistoryForSecurity } from "./priceHistorySyncService";

export interface WatchlistWarmupResult {
  /** Whether a current price was fetched and stored. */
  priceUpdated: boolean;
  /** Whether daily closes were backfilled (false if already cached). */
  historyUpdated: boolean;
  /** Why warming failed, when it did. The watchlist row still exists — the
   * page's empty states cover the missing data — so this is reported, not
   * thrown. */
  error: string | null;
}

/**
 * Fetches a freshly-watched security's current price and daily-close
 * history right away, instead of leaving it blank until the user happens
 * to run a portfolio-wide refresh from another page.
 *
 * Without this, a ticker added to the watchlist has `currentPrice: null`
 * and zero `Price` rows, so the Watchlist page shows no price and no day
 * change, and its price chart renders the "no history yet" empty state
 * with the candlestick toggle hidden (no OHLC to draw) — the symptom
 * looks like a broken chart rather than missing data.
 *
 * Never throws: a provider outage must not block adding to a watchlist,
 * which is a purely local bookkeeping action.
 *
 * Also the per-ticker step behind the Watchlist page's Refresh button (see
 * watchlistRefreshService.ts) — bringing a watched ticker up to date is
 * the same work as warming a freshly added one, and both need the price
 * and the history to move together.
 */
export async function warmWatchlistSecurity(securityId: string): Promise<WatchlistWarmupResult> {
  try {
    // Sequential, not Promise.all, to stay within the provider's rate
    // limit — the same reason `refreshAllPrices` loops rather than bursts.
    const priceUpdated = await refreshPriceForSecurity(securityId);
    const historyUpdated = await syncPriceHistoryForSecurity(securityId);
    return { priceUpdated, historyUpdated, error: null };
  } catch (error) {
    return {
      priceUpdated: false,
      historyUpdated: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
