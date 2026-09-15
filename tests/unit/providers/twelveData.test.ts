import { afterEach, describe, expect, it, vi } from "vitest";
import { TwelveDataProvider } from "@/lib/providers/financialData/twelveData";
import { ProviderError } from "@/lib/providers/financialData/types";

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("TwelveDataProvider.getQuote", () => {
  it("parses a successful quote response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        symbol: "AAPL",
        currency: "USD",
        close: "225.50",
        datetime: "2024-06-01",
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new TwelveDataProvider("test-key");
    const quote = await provider.getQuote("AAPL");

    expect(quote?.price.toString()).toBe("225.5");
    expect(quote?.currency).toBe("USD");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as URL;
    expect(calledUrl.toString()).toContain("apikey=test-key");
    expect(calledUrl.toString()).toContain("symbol=AAPL");
  });

  it("throws a non-retryable ProviderError on an invalid API key (401)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(401, { code: 401, message: "Invalid or incorrect API key.", status: "error" })
      )
    );

    const provider = new TwelveDataProvider("bad-key");
    await expect(provider.getQuote("AAPL")).rejects.toMatchObject({
      retryable: false,
    });
  });

  it("retries once on a 429 rate-limit response, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(429, { code: 429, message: "API request limit reached", status: "error" })
      )
      .mockResolvedValueOnce(
        mockResponse(200, { symbol: "AAPL", currency: "USD", close: "225.50", datetime: "2024-06-01" })
      );
    vi.stubGlobal("fetch", fetchMock);

    const provider = new TwelveDataProvider("test-key");
    const quote = await provider.getQuote("AAPL");

    expect(quote?.price.toString()).toBe("225.5");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after a second consecutive 429 (only retries once)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(429, { code: 429, message: "API request limit reached", status: "error" })
      )
    );

    const provider = new TwelveDataProvider("test-key");
    await expect(provider.getQuote("AAPL")).rejects.toBeInstanceOf(ProviderError);
  });

  it("returns null when the response has no close price", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse(200, { symbol: "AAPL", currency: "USD", close: "" }))
    );
    const provider = new TwelveDataProvider("test-key");
    expect(await provider.getQuote("AAPL")).toBeNull();
  });
});

describe("TwelveDataProvider.getHistoricalPrices", () => {
  it("parses a time_series response into price points", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          meta: { currency: "USD" },
          values: [
            { datetime: "2024-06-01", open: "220", high: "226", low: "219", close: "225.5" },
            { datetime: "2024-05-31", open: "218", high: "221", low: "217", close: "220" },
          ],
        })
      )
    );

    const provider = new TwelveDataProvider("test-key");
    const points = await provider.getHistoricalPrices(
      "AAPL",
      new Date("2024-05-01"),
      new Date("2024-06-01")
    );

    expect(points).toHaveLength(2);
    expect(points[0].close.toString()).toBe("225.5");
    expect(points[0].currency).toBe("USD");
  });

  it("returns an empty array when the provider has no values", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockResponse(200, { meta: { currency: "USD" } }))
    );
    const provider = new TwelveDataProvider("test-key");
    const points = await provider.getHistoricalPrices("AAPL", new Date("2024-05-01"), new Date());
    expect(points).toEqual([]);
  });
});

describe("TwelveDataProvider.getDividends", () => {
  it("parses a dividends response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          meta: { symbol: "AAPL", currency: "USD" },
          dividends: [{ ex_date: "2024-08-10", amount: 0.27 }],
        })
      )
    );

    const provider = new TwelveDataProvider("test-key");
    const dividends = await provider.getDividends("AAPL");

    expect(dividends).toHaveLength(1);
    expect(dividends[0].amountPerShare.toString()).toBe("0.27");
    expect(dividends[0].currency).toBe("USD");
  });
});

describe("TwelveDataProvider.searchSecurities", () => {
  it("parses a symbol_search response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          data: [
            {
              symbol: "AA",
              instrument_name: "Alcoa Corp",
              exchange: "NYSE",
              country: "United States",
              currency: "USD",
              instrument_type: "Common Stock",
            },
          ],
        })
      )
    );

    const provider = new TwelveDataProvider("test-key");
    const results = await provider.searchSecurities("AA");

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      ticker: "AA",
      name: "Alcoa Corp",
      exchange: "NYSE",
      currency: "USD",
      assetType: "Common Stock",
    });
  });
});
