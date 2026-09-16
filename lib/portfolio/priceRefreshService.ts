import { getSecurityById, listSecurities, updateSecurityPrice } from "@/lib/db/securities";
import {
  getFinancialDataProvider,
  ProviderError,
  type FinancialDataProvider,
} from "@/lib/providers/financialData";
import { refreshExchangeRates } from "./fxRefreshService";

export interface PriceRefreshSummary {
  provider: string;
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ ticker: string; message: string }>;
}

interface QuotableSecurity {
  id: string;
  ticker: string;
  exchange: string | null;
  currency: string;
}

/**
 * Fetches and stores one security's current price. Returns false when the
 * provider has no quote for it (the `manual` provider never has one), and
 * throws when the quote can't be trusted — see the currency guard below.
 */
async function fetchAndStoreQuote(
  provider: FinancialDataProvider,
  security: QuotableSecurity
): Promise<boolean> {
  const quote = await provider.getQuote(security.ticker, security.exchange);
  if (!quote) return false;
  // A ticker can resolve to a *different* listing than the one we hold
  // (e.g. "ASML" without an exchange hint returns the USD NASDAQ
  // depositary receipt, not the EUR Euronext Amsterdam shares this
  // Security actually represents). Writing that price would silently
  // corrupt cost-basis/P&L math with a wrong-currency number — refuse
  // it instead of ever guessing.
  if (quote.currency !== security.currency) {
    throw new ProviderError(
      `Provider returned a ${quote.currency} quote for a ${security.currency} security (likely resolved to a different listing) — set a more specific exchange on this security and retry`,
      false
    );
  }
  await updateSecurityPrice(security.id, quote.price.toString());
  return true;
}

/**
 * Single-security counterpart to `refreshAllPrices`, for the moments a
 * security is first created and its price is still null — waiting for the
 * next portfolio-wide refresh would leave it blank in the meantime. FX
 * rates are deliberately not touched here; that stays a portfolio-wide
 * concern.
 */
export async function refreshPriceForSecurity(securityId: string): Promise<boolean> {
  const security = await getSecurityById(securityId);
  if (!security) return false;
  return fetchAndStoreQuote(getFinancialDataProvider(), security);
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
      if (await fetchAndStoreQuote(provider, security)) {
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

  const fx = await refreshExchangeRates();

  return {
    provider: provider.name,
    updated: updated + fx.updated,
    failed: failed + fx.failed,
    skipped: skipped + fx.skipped,
    errors: [...errors, ...fx.errors.map((e) => ({ ticker: e.pair, message: e.message }))],
  };
}
