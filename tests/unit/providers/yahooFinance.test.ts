import { afterEach, describe, expect, it, vi } from "vitest";
import { YahooFinanceProvider } from "@/lib/providers/financialData/yahooFinance";
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

describe("YahooFinanceProvider.getQuote", () => {
  it("parses a successful chart response", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockResponse(200, {
        chart: {
          error: null,
          result: [
            {
              meta: {
                currency: "EUR",
                symbol: "BNP.PA",
                regularMarketPrice: 65.42,
                regularMarketTime: 1_717_000_000,
              },
              indicators: { quote: [{}] },
            },
          ],
        },
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const quote = await new YahooFinanceProvider().getQuote("BNP.PA");

    expect(quote?.price.toString()).toBe("65.42");
    expect(quote?.currency).toBe("EUR");
  });

  it("returns null when Yahoo reports an error for a known-shaped symbol", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          chart: { error: { code: "Not Found", description: "No data found" }, result: null },
        })
      )
    );

    expect(await new YahooFinanceProvider().getQuote("XYZ.AS")).toBeNull();
  });

  it("turns a 404 into an actionable error naming the suffixed symbols that do exist", async () => {
    const fetchMock = vi.fn().mockImplementation((url: URL) => {
      if (url.pathname.startsWith("/v8/finance/chart")) {
        return Promise.resolve(mockResponse(404, {}));
      }
      return Promise.resolve(
        mockResponse(200, {
          quotes: [
            { symbol: "BNP.PA", longname: "BNP Paribas SA", exchange: "PAR" },
            { symbol: "BNPQY", longname: "BNP Paribas SA", exchange: "OQX" },
          ],
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const error = await new YahooFinanceProvider().getQuote("BNP").catch((e) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.retryable).toBe(false);
    expect(error.message).toContain('no listing for "BNP"');
    expect(error.message).toContain("BNP.PA");
    // Only suffixed variants of the requested ticker are suggested — the
    // US depositary receipt is a different instrument, not a spelling of
    // this one.
    expect(error.message).not.toContain("BNPQY");
  });

  it("still reports the symbol as unknown when the search endpoint also fails", async () => {
    const fetchMock = vi.fn().mockImplementation((url: URL) =>
      url.pathname.startsWith("/v8/finance/chart")
        ? Promise.resolve(mockResponse(404, {}))
        : Promise.resolve(mockResponse(500, {}))
    );
    vi.stubGlobal("fetch", fetchMock);

    const error = await new YahooFinanceProvider().getQuote("BNP").catch((e) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error.message).toContain('no listing for "BNP"');
  });
});

describe("YahooFinanceProvider.getSplits", () => {
  it("converts Yahoo's numerator/denominator into a single multiplier", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          chart: {
            error: null,
            result: [
              {
                meta: { currency: "USD", symbol: "NVDA" },
                indicators: { quote: [{}] },
                events: {
                  splits: {
                    "1717000000": {
                      date: 1_717_000_000,
                      numerator: 10,
                      denominator: 1,
                      splitRatio: "10:1",
                    },
                    "1500000000": {
                      date: 1_500_000_000,
                      numerator: 1,
                      denominator: 10,
                      splitRatio: "1:10",
                    },
                  },
                },
              },
            ],
          },
        })
      )
    );

    const splits = await new YahooFinanceProvider().getSplits("NVDA");

    expect(splits).toHaveLength(2);
    const byRatio = splits.map((s) => s.ratio.toString()).sort();
    expect(byRatio).toEqual(["0.1", "10"]);
    expect(splits[0].ticker).toBe("NVDA");
  });

  it("skips a split whose ratio would be infinite or zero", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          chart: {
            error: null,
            result: [
              {
                meta: { currency: "USD", symbol: "BAD" },
                indicators: { quote: [{}] },
                events: {
                  splits: {
                    a: { date: 1_717_000_000, numerator: 1, denominator: 0, splitRatio: "1:0" },
                    b: { date: 1_717_100_000, numerator: 0, denominator: 1, splitRatio: "0:1" },
                  },
                },
              },
            ],
          },
        })
      )
    );

    expect(await new YahooFinanceProvider().getSplits("BAD")).toEqual([]);
  });

  it("returns an empty list when the symbol has no splits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockResponse(200, {
          chart: {
            error: null,
            result: [{ meta: { currency: "EUR", symbol: "ASML.AS" }, indicators: { quote: [{}] } }],
          },
        })
      )
    );

    expect(await new YahooFinanceProvider().getSplits("ASML.AS")).toEqual([]);
  });
});
