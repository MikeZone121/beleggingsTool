import Decimal from "decimal.js";
import type {
  FinancialDataProvider,
  NewsCapableProvider,
  NewsHeadline,
  ProviderQuote,
  ProviderPricePoint,
  ProviderDividendEvent,
  ProviderSecurityMatch,
  ProviderSplitEvent,
  SplitCapableProvider,
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

/** Carries the HTTP status alongside the message so `fetchChart` can treat
 * a 404 ("Yahoo lists no such symbol") differently from any other failure.
 * Internal to this file — callers still only ever see a `ProviderError`. */
class YahooHttpError extends ProviderError {
  constructor(
    message: string,
    retryable: boolean,
    readonly status: number
  ) {
    super(message, retryable);
  }
}

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
    splits?: Record<
      string,
      { date: number; numerator: number; denominator: number; splitRatio: string }
    >;
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
export class YahooFinanceProvider
  implements FinancialDataProvider, NewsCapableProvider, SplitCapableProvider
{
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
      throw new YahooHttpError(
        `Yahoo Finance request to ${url.pathname} failed with status ${response.status}`,
        retryable,
        response.status
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

    let data: ChartResponse;
    try {
      data = await this.requestWithRetry<ChartResponse>(url);
    } catch (error) {
      // A 404 means Yahoo has no such symbol at all — almost always a
      // ticker stored without Yahoo's exchange suffix ("BNP" instead of
      // "BNP.PA"). The raw status tells the user nothing actionable, so
      // name the listings that do exist instead.
      if (error instanceof YahooHttpError && error.status === 404) {
        throw new ProviderError(await this.unknownSymbolMessage(ticker), false);
      }
      throw error;
    }
    if (data.chart.error) {
      // Yahoo returns a 200 with a populated `error` field for unknown
      // symbols rather than a non-2xx status — treat as "no data".
      return null;
    }
    return data.chart.result?.[0] ?? null;
  }

  /**
   * Builds the message for a symbol Yahoo doesn't list, enriched with real
   * candidates from the search endpoint. Suggestions are only ever shown
   * to the user — never applied to stored data — because a same-company
   * listing on another exchange trades in another currency at another
   * price, so picking one automatically would quietly corrupt P&L (the
   * same reason `fetchAndStoreQuote` refuses a currency-mismatched quote).
   */
  private async unknownSymbolMessage(ticker: string): Promise<string> {
    const base = `Yahoo Finance has no listing for "${ticker}" — its symbols carry an exchange suffix (e.g. "BNP.PA" for Euronext Paris, "ASML.AS" for Amsterdam)`;

    let suggestions: ProviderSecurityMatch[] = [];
    try {
      const matches = await this.searchSecurities(ticker);
      const prefix = `${ticker.toUpperCase()}.`;
      // Prefer suffixed variants of this exact ticker; fall back to
      // whatever the search ranked highest for the name.
      const exact = matches.filter((m) => m.ticker.toUpperCase().startsWith(prefix));
      suggestions = (exact.length > 0 ? exact : matches).slice(0, 3);
    } catch {
      // The search endpoint is as unofficial as the chart one; a failure
      // here must not replace the (already useful) base message.
    }

    if (suggestions.length === 0) {
      return `${base}. Update this security's ticker to the symbol Yahoo uses.`;
    }

    const list = suggestions
      .map((m) => (m.exchange ? `${m.ticker} (${m.name} — ${m.exchange})` : `${m.ticker} (${m.name})`))
      .join(", ");
    return `${base}. Did you mean ${list}? Update this security's ticker to the matching symbol.`;
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

  /**
   * Share splits, from the same chart endpoint as `getDividends` but with
   * `events=split`. Yahoo reports each split as a numerator/denominator
   * pair ("10:1" => 10/1), which is converted here into the single
   * multiplier the cost-basis ledger wants, so a 1-for-10 reverse split
   * arrives as 0.1 rather than as a ratio someone downstream has to invert.
   *
   * Same ten-year window and same reason as the dividend call: the events
   * only come back for the requested period, and there is no "all splits"
   * endpoint.
   */
  async getSplits(ticker: string, _exchange?: string | null): Promise<ProviderSplitEvent[]> {
    void _exchange;
    const to = new Date();
    const from = new Date(to);
    from.setFullYear(from.getFullYear() - 10);

    const result = await this.fetchChart(ticker, {
      interval: "1d",
      period1: Math.floor(from.getTime() / 1000).toString(),
      period2: Math.floor(to.getTime() / 1000).toString(),
      events: "split",
    });
    if (!result?.events?.splits) return [];

    const symbol = result.meta.symbol;

    return Object.values(result.events.splits)
      // A zero denominator would make the ratio infinite; a zero numerator
      // would wipe the position out. Both mean the payload is wrong, not
      // that something happened to the holding — skip rather than write.
      .filter((s) => s.numerator > 0 && s.denominator > 0)
      .map((s) => ({
        ticker: symbol,
        effectiveDate: new Date(s.date * 1000),
        ratio: new Decimal(s.numerator).dividedBy(s.denominator),
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
