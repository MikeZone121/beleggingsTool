import { refreshAllPrices } from "./priceRefreshService";
import { syncPriceHistory } from "./priceHistorySyncService";
import { syncDividendHistory } from "./dividendSyncService";
import { createDividendTransactionsFromHistory } from "./dividendTransactionService";

export interface RefreshAllSummary {
  provider: string;
  prices: { updated: number; failed: number; skipped: number };
  priceHistory: { updated: number; failed: number; skipped: number };
  dividends: { updated: number; failed: number; skipped: number };
  dividendTransactions: { created: number; failed: number };
  /** Every individual failure across all four steps, prefixed with which
   * step it came from — the four buttons this replaces each show their
   * own errors in detail; this summary keeps that detail instead of
   * flattening it into just a count. */
  errors: Array<{ step: string; ticker: string; message: string }>;
}

/**
 * The single-click counterpart to the four separate sync buttons scattered
 * across Portfolio ("Refresh Prices"), Analytics ("Sync Price History"),
 * and Dividends ("Sync Dividend History") — each of those updates a
 * different slice of market data, and a user clicking only one (most
 * naturally "Refresh Prices", since that's the most visible one) can end
 * up looking at a portfolio value that seems stuck even right after a
 * "refresh", because the *other* three weren't run. This runs all four in
 * one action: current prices (which already includes FX rates — see
 * `priceRefreshService.ts`), historical prices (for the benchmark chart/
 * drawdown), dividend history, and the dividend transactions derived from
 * it.
 *
 * Runs sequentially, not in parallel — same rate-limit-friendly reasoning
 * as each individual step already follows.
 */
export async function refreshAllMarketData(
  userId: string,
  portfolioId: string
): Promise<RefreshAllSummary> {
  const priceSummary = await refreshAllPrices();
  const priceHistorySummary = await syncPriceHistory();
  const dividendSummary = await syncDividendHistory();
  const dividendTxSummary = await createDividendTransactionsFromHistory(userId, portfolioId);

  const errors: RefreshAllSummary["errors"] = [
    ...priceSummary.errors.map((e) => ({ step: "Prices", ticker: e.ticker, message: e.message })),
    ...priceHistorySummary.errors.map((e) => ({
      step: "Price history",
      ticker: e.ticker,
      message: e.message,
    })),
    ...dividendSummary.errors.map((e) => ({
      step: "Dividend history",
      ticker: e.ticker,
      message: e.message,
    })),
    ...dividendTxSummary.errors.map((e) => ({
      step: "Dividend transactions",
      ticker: e.securityId,
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
    dividends: {
      updated: dividendSummary.updated,
      failed: dividendSummary.failed,
      skipped: dividendSummary.skipped,
    },
    dividendTransactions: {
      created: dividendTxSummary.created,
      failed: dividendTxSummary.failed,
    },
    errors,
  };
}
