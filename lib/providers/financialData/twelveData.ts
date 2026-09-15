import Decimal from "decimal.js";
import type {
  FinancialDataProvider,
  ProviderQuote,
  ProviderPricePoint,
  ProviderDividendEvent,
  ProviderSecurityMatch,
} from "./types";
import { ProviderError } from "./types";

const BASE_URL = "https://api.twelvedata.com";
const REQUEST_TIMEOUT_MS = 10_000;

interface TwelveDataErrorBody {
  code: number;
  message: string;
  status: "error";
}

/**
 * Twelve Data implementation of `FinancialDataProvider` (see
 * https://twelvedata.com/docs). Endpoints used: `/quote`, `/time_series`,
 * `/dividends`, `/symbol_search`. All amounts/prices arrive as JSON strings
 * or numbers — always parsed into `Decimal`, never left as `number`.
 *
 * Free-tier limits (as of writing): ~800 requests/day, 8/minute — callers
 * should batch/cache rather than call this per page load (see
 * `lib/portfolio/priceRefreshService.ts`).
 */
export class TwelveDataProvider implements FinancialDataProvider {
  readonly name = "twelvedata";

  constructor(private readonly apiKey: string) {}

  private async request<T>(path: string, params: Record<string, string>): Promise<T> {
    const url = new URL(`${BASE_URL}${path}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set("apikey", this.apiKey);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    let body: unknown;
    try {
      response = await fetch(url, { signal: controller.signal });
      body = await response.json();
    } catch (error) {
      throw new ProviderError(
        `Twelve Data request to ${path} failed: ${error instanceof Error ? error.message : "network error"}`,
        true
      );
    } finally {
      clearTimeout(timeout);
    }

    const errorBody = body as Partial<TwelveDataErrorBody> | undefined;
    if (!response.ok || errorBody?.status === "error") {
      const retryable = response.status === 429 || response.status >= 500;
      throw new ProviderError(
        errorBody?.message ?? `Twelve Data request to ${path} failed with status ${response.status}`,
        retryable
      );
    }

    return body as T;
  }

  /** Retries once, after a short delay, only for errors marked retryable. */
  private async requestWithRetry<T>(path: string, params: Record<string, string>): Promise<T> {
    try {
      return await this.request<T>(path, params);
    } catch (error) {
      if (error instanceof ProviderError && error.retryable) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await this.request<T>(path, params);
      }
      throw error;
    }
  }

  async getQuote(ticker: string, exchange?: string | null): Promise<ProviderQuote | null> {
    interface QuoteResponse {
      symbol: string;
      currency: string;
      close: string;
      datetime: string;
    }

    const params: Record<string, string> = { symbol: ticker };
    if (exchange) params.exchange = exchange;

    const data = await this.requestWithRetry<QuoteResponse>("/quote", params);
    if (!data.close) return null;

    return {
      ticker: data.symbol,
      price: new Decimal(data.close),
      currency: data.currency,
      asOf: new Date(data.datetime),
    };
  }

  async getHistoricalPrices(
    ticker: string,
    from: Date,
    to: Date,
    exchange?: string | null
  ): Promise<ProviderPricePoint[]> {
    interface TimeSeriesResponse {
      meta: { currency: string };
      values?: Array<{
        datetime: string;
        open: string;
        high: string;
        low: string;
        close: string;
      }>;
    }

    const params: Record<string, string> = {
      symbol: ticker,
      interval: "1day",
      start_date: from.toISOString().slice(0, 10),
      end_date: to.toISOString().slice(0, 10),
    };
    if (exchange) params.exchange = exchange;

    const data = await this.requestWithRetry<TimeSeriesResponse>("/time_series", params);
    const currency = data.meta.currency;

    return (data.values ?? []).map((v) => ({
      date: new Date(v.datetime),
      open: v.open ? new Decimal(v.open) : null,
      high: v.high ? new Decimal(v.high) : null,
      low: v.low ? new Decimal(v.low) : null,
      close: new Decimal(v.close),
      currency,
    }));
  }

  async getDividends(ticker: string, exchange?: string | null): Promise<ProviderDividendEvent[]> {
    interface DividendsResponse {
      meta: { symbol: string; currency: string };
      dividends?: Array<{ ex_date: string; amount: number }>;
    }

    const params: Record<string, string> = { symbol: ticker };
    if (exchange) params.exchange = exchange;

    const data = await this.requestWithRetry<DividendsResponse>("/dividends", params);

    return (data.dividends ?? []).map((d) => ({
      ticker: data.meta.symbol,
      exDividendDate: new Date(d.ex_date),
      amountPerShare: new Decimal(d.amount),
      currency: data.meta.currency,
    }));
  }

  async searchSecurities(query: string): Promise<ProviderSecurityMatch[]> {
    interface SearchResponse {
      data?: Array<{
        symbol: string;
        instrument_name: string;
        exchange: string;
        country: string;
        currency: string;
        instrument_type: string;
      }>;
    }

    const data = await this.requestWithRetry<SearchResponse>("/symbol_search", { symbol: query });

    return (data.data ?? []).map((s) => ({
      ticker: s.symbol,
      name: s.instrument_name,
      exchange: s.exchange ?? null,
      currency: s.currency,
      country: s.country ?? null,
      assetType: s.instrument_type ?? null,
    }));
  }
}
