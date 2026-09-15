import { listSecurities } from "@/lib/db/securities";
import { upsertDividendEvent } from "@/lib/db/dividends";
import { getFinancialDataProvider, ProviderError } from "@/lib/providers/financialData";

export interface DividendSyncSummary {
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ ticker: string; message: string }>;
}

/**
 * Populates the `Dividend` table (unused until now — see
 * `lib/finance/dividendCalendar.ts`) with each security's paid-dividend
 * history from the configured `FinancialDataProvider`, so the Dividends
 * page can estimate an upcoming ex-dividend date/amount from real history
 * instead of nothing. Every event synced here is historical/already paid
 * (`status: "PAID"`) — Yahoo's free endpoints don't expose forward-looking
 * declared dividends, so "next payment" is always a derived estimate, never
 * a confirmed date (see `estimateNextDividend`).
 *
 * With the default `manual` provider this is a no-op, same as
 * `refreshAllPrices`.
 */
export async function syncDividendHistory(): Promise<DividendSyncSummary> {
  const provider = getFinancialDataProvider();
  const securities = await listSecurities();

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ ticker: string; message: string }> = [];

  for (const security of securities) {
    try {
      const events = await provider.getDividends(security.ticker, security.exchange);
      if (events.length === 0) {
        skipped += 1;
        continue;
      }
      for (const event of events) {
        await upsertDividendEvent({
          securityId: security.id,
          exDividendDate: event.exDividendDate,
          dividendPerShare: event.amountPerShare.toString(),
          currency: event.currency,
          source: provider.name,
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

  return { updated, failed, skipped, errors };
}
