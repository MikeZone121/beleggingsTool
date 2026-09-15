import type Decimal from "decimal.js";

/**
 * External market-data provider abstraction. The app depends only on this
 * interface — never on a specific vendor's request/response shape — so the
 * concrete provider (currently Twelve Data, see `twelveData.ts`) can be
 * swapped via `FINANCIAL_DATA_PROVIDER` without touching callers.
 */

export interface ProviderQuote {
  ticker: string;
  price: Decimal;
  currency: string;
  asOf: Date;
}

export interface ProviderPricePoint {
  date: Date;
  open: Decimal | null;
  high: Decimal | null;
  low: Decimal | null;
  close: Decimal;
  currency: string;
}

export interface ProviderDividendEvent {
  ticker: string;
  exDividendDate: Date;
  amountPerShare: Decimal;
  currency: string;
}

export interface ProviderSecurityMatch {
  ticker: string;
  name: string;
  exchange: string | null;
  currency: string;
  country: string | null;
  /** Raw instrument-type string from the provider (e.g. "Common Stock",
   * "ETF") — mapping this onto our `AssetType` enum is left to the caller,
   * since providers use inconsistent vocabularies. */
  assetType: string | null;
}

/** Thrown by provider implementations for any non-2xx/parse failure.
 * `retryable` distinguishes a transient failure (rate limit, 5xx, timeout)
 * from a permanent one (bad ticker, invalid key) so callers can decide
 * whether to retry or surface the error immediately. */
export class ProviderError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

export interface FinancialDataProvider {
  readonly name: string;
  searchSecurities(query: string): Promise<ProviderSecurityMatch[]>;
  getQuote(ticker: string, exchange?: string | null): Promise<ProviderQuote | null>;
  getHistoricalPrices(
    ticker: string,
    from: Date,
    to: Date,
    exchange?: string | null
  ): Promise<ProviderPricePoint[]>;
  getDividends(ticker: string, exchange?: string | null): Promise<ProviderDividendEvent[]>;
}
