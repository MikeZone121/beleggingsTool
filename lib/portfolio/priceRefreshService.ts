import { listSecurities, updateSecurityPrice } from "@/lib/db/securities";
import { getFinancialDataProvider, ProviderError } from "@/lib/providers/financialData";
import { refreshExchangeRates } from "./fxRefreshService";

export interface PriceRefreshSummary {
  provider: string;
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ ticker: string; message: string }>;
}

/**
 * Refreshes `currentPrice`/`priceUpdatedAt` for every security from the
 * configured `FinancialDataProvider`, then the `ExchangeRate` table (see
 * `refreshExchangeRates`) so foreign-currency holdings' base-currency
 * market value stays computable — a stale/missing FX rate otherwise makes
 * `deriveHoldings` drop that holding's value entirely (`marketValueBase:
 * null`), which surfaces as a misleadingly large negative cash weight
 * rather than an obvious "FX rate missing" message. Counts from both are
 * merged into one summary since the "Refresh Prices" button is the only
 * entry point for either.
 *
 * With the default `manual` provider this is a no-op (every quote comes
 * back null) — manual price entry via `EditPricePopover` keeps working
 * exactly as before.
 *
 * Runs sequentially (not `Promise.all`) to respect the provider's rate
 * limit rather than bursting requests.
 */
export async function refreshAllPrices(): Promise<PriceRefreshSummary> {
  const provider = getFinancialDataProvider();
  const securities = await listSecurities();

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ ticker: string; message: string }> = [];

  for (const security of securities) {
    try {
      const quote = await provider.getQuote(security.ticker, security.exchange);
      if (!quote) {
        skipped += 1;
        continue;
      }
      // A ticker can resolve to a *different* listing than the one we hold
      // (e.g. "ASML" without an exchange hint returns the USD NASDAQ
      // depositary receipt, not the EUR Euronext Amsterdam shares this
      // Security actually represents). Writing that price would silently
      // corrupt cost-basis/P&L math with a wrong-currency number — refuse
      // it as a failure instead of ever guessing.
      if (quote.currency !== security.currency) {
        failed += 1;
        errors.push({
          ticker: security.ticker,
          message: `Provider returned a ${quote.currency} quote for a ${security.currency} security (likely resolved to a different listing) — set a more specific exchange on this security and retry`,
        });
        continue;
      }
      await updateSecurityPrice(security.id, quote.price.toString());
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

  const fx = await refreshExchangeRates();

  return {
    provider: provider.name,
    updated: updated + fx.updated,
    failed: failed + fx.failed,
    skipped: skipped + fx.skipped,
    errors: [...errors, ...fx.errors.map((e) => ({ ticker: e.pair, message: e.message }))],
  };
}
