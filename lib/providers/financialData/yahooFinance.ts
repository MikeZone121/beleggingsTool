import Decimal from "decimal.js";
import type {
  FinancialDataProvider,
  NewsCapableProvider,
  NewsHeadline,
  ProviderQuote,
  ProviderPricePoint,
  ProviderDividendEvent,
  ProviderSecurityMatch,
} from "./types";
import { ProviderError } from "./types";
import { guessCurrencyFromExchange } from "./exchangeCurrencyMapping";

const CHART_BASE_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const SEARCH_BASE_URL = "https://query2.finance.yahoo.com/v1/finance/search";
const REQUEST_TIMEOUT_MS = 10_000;

// Yahoo blocks requests without a browser-like User-Agent (returns an
// opaque 999 status), so every request sends one.
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
};

interface ChartResult {
  meta: {
    currency: string;
    symbol: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
  };
  timestamp?: number[];
  indicators: {
    quote: [{ open?: (number | null)[]; high?: (number | null)[]; low?: (number | null)[]; close?: (number | null)[] }];
  };
  events?: {
    dividends?: Record<string, { amount: number; date: number }>;
  };
}

interface ChartResponse {
  chart: {
    result: [ChartResult] | null;
    error: { code: string; description: string } | null;
  };
}

interface SearchResponse {
  quotes?: Array<{
    symbol: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    quoteType?: string;
  }>;
  news?: Array<{
    title: string;
    publisher: string;
    link: string;
    providerPublishTime: number;
  }>;
}

/**
 * Yahoo Finance implementation of `FinancialDataProvider`, backed by
 * Yahoo's unofficial (undocumented, no-API-key) `query1`/`query2` JSON
 * endpoints — the same ones the yahoo.com/finance UI itself calls. No
 * published rate limits or SLA; treat failures as more likely than with a
 * paid provider and prefer caching over calling this per page load (see
 * `lib/portfolio/priceRefreshService.ts`).
 *
 * Unlike Twelve Data, Yahoo encodes the exchange directly in the symbol
 * (e.g. `ASML.AS` for Amsterdam) rather than as a separate parameter, so
 * the `exchange` argument on these methods is accepted for interface
 * compatibility but unused — callers should pass the full Yahoo symbol as
 * returned by `searchSecurities`.
 */
export class YahooFinanceProvider implements FinancialDataProvider, NewsCapableProvider {
  readonly name = "yahoo";

  private async request<T>(url: URL): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    let body: unknown;
    try {
      response = await fetch(url, { signal: controller.signal, headers: HEADERS });
      body = await response.json();
    } catch (error) {
      throw new ProviderError(
        `Yahoo Finance request to ${url.pathname} failed: ${error instanceof Error ? error.message : "network error"}`,
        true
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw new ProviderError(
        `Yahoo Finance request to ${url.pathname} failed with status ${response.status}`,
        retryable
      );
    }

    return body as T;
  }

  /** Retries once, after a short delay, only for errors marked retryable. */
  private async requestWithRetry<T>(url: URL): Promise<T> {
    try {
      return await this.request<T>(url);
    } catch (error) {
      if (error instanceof ProviderError && error.retryable) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        return await this.request<T>(url);
      }
      throw error;
    }
  }

  private async fetchChart(ticker: string, params: Record<string, string>): Promise<ChartResult | null> {
    const url = new URL(`${CHART_BASE_URL}/${encodeURIComponent(ticker)}`);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }

    const data = await this.requestWithRetry<ChartResponse>(url);
    if (data.chart.error) {
      // Yahoo returns a 200 with a populated `error` field for unknown
      // symbols rather than a non-2xx status — treat as "no data".
      return null;
    }
    return data.chart.result?.[0] ?? null;
  }

  async getQuote(ticker: string): Promise<ProviderQuote | null> {
    const result = await this.fetchChart(ticker, { interval: "1d", range: "1d" });
    if (!result?.meta.regularMarketPrice) return null;

    return {
      ticker: result.meta.symbol,
      price: new Decimal(result.meta.regularMarketPrice),
      currency: result.meta.currency,
      asOf: result.meta.regularMarketTime
        ? new Date(result.meta.regularMarketTime * 1000)
        : new Date(),
    };
  }

  async getHistoricalPrices(ticker: string, from: Date, to: Date): Promise<ProviderPricePoint[]> {
    const result = await this.fetchChart(ticker, {
      interval: "1d",
      period1: Math.floor(from.getTime() / 1000).toString(),
      period2: Math.floor(to.getTime() / 1000).toString(),
    });
    if (!result?.timestamp) return [];

    const currency = result.meta.currency;
    const quote = result.indicators.quote[0];

    return result.timestamp
      .map((ts, i) => {
        const close = quote.close?.[i];
        if (close === null || close === undefined) return null;
        return {
          date: new Date(ts * 1000),
          open: quote.open?.[i] != null ? new Decimal(quote.open[i] as number) : null,
          high: quote.high?.[i] != null ? new Decimal(quote.high[i] as number) : null,
          low: quote.low?.[i] != null ? new Decimal(quote.low[i] as number) : null,
          close: new Decimal(close),
          currency,
        };
      })
      .filter((point): point is ProviderPricePoint => point !== null);
  }

  async getDividends(ticker: string, _exchange?: string | null): Promise<ProviderDividendEvent[]> {
    void _exchange;
    // Ten-year window: Yahoo only returns dividend events inside the
    // requested `period1`/`period2` range, and there's no "all dividends"
    // endpoint the way Twelve Data has.
    const to = new Date();
    const from = new Date(to);
    from.setFullYear(from.getFullYear() - 10);

    const result = await this.fetchChart(ticker, {
      interval: "1d",
      period1: Math.floor(from.getTime() / 1000).toString(),
      period2: Math.floor(to.getTime() / 1000).toString(),
      events: "div",
    });
    if (!result?.events?.dividends) return [];

    const currency = result.meta.currency;
    const symbol = result.meta.symbol;

    return Object.values(result.events.dividends).map((d) => ({
      ticker: symbol,
      exDividendDate: new Date(d.date * 1000),
      amountPerShare: new Decimal(d.amount),
      currency,
    }));
  }

  async searchSecurities(query: string): Promise<ProviderSecurityMatch[]> {
    const url = new URL(SEARCH_BASE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("quotesCount", "10");
    url.searchParams.set("newsCount", "0");

    const data = await this.requestWithRetry<SearchResponse>(url);

    return (data.quotes ?? [])
      .filter((q) => q.symbol)
      .map((q) => ({
        ticker: q.symbol,
        name: q.longname ?? q.shortname ?? q.symbol,
        exchange: q.exchange ?? null,
        // Yahoo's search endpoint doesn't return currency or country —
        // currency is a best-effort guess from the exchange code (see
        // `exchangeCurrencyMapping.ts`); country isn't available at all.
        currency: guessCurrencyFromExchange(q.exchange ?? null),
        country: null,
        assetType: q.quoteType ?? null,
      }));
  }

  async getNews(query: string, limit = 5): Promise<NewsHeadline[]> {
    const url = new URL(SEARCH_BASE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("quotesCount", "0");
    url.searchParams.set("newsCount", limit.toString());

    const data = await this.requestWithRetry<SearchResponse>(url);

    return (data.news ?? []).map((n) => ({
      title: n.title,
      publisher: n.publisher,
      publishedAt: new Date(n.providerPublishTime * 1000),
      url: n.link,
    }));
  }
}
