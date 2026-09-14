import { describe, expect, it } from "vitest";
import { deriveHoldings, type SecurityMeta } from "@/lib/finance/holdings";
import { calculatePortfolioValue } from "@/lib/finance/portfolioValue";
import { d, resetSequence, tx } from "./helpers";

const aapl: SecurityMeta = {
  id: "sec-aapl",
  ticker: "AAPL",
  name: "Apple Inc.",
  assetType: "STOCK",
  sector: "Technology",
  country: "US",
  currency: "USD",
};

const asml: SecurityMeta = {
  id: "sec-asml",
  ticker: "ASML",
  name: "ASML Holding",
  assetType: "STOCK",
  sector: "Technology",
  country: "NL",
  currency: "EUR",
};

const recentPriceDate = new Date();

describe("deriveHoldings", () => {
  it("derives market value, unrealized P&L in a single currency (no FX needed)", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: asml.id, type: "BUY", date: "2024-01-01", quantity: 10, price: 600 }),
    ];
    const holdings = deriveHoldings(
      transactions,
      [asml],
      new Map([[asml.id, { securityId: asml.id, price: d(700), currency: "EUR", asOf: recentPriceDate }]]),
      [],
      "EUR"
    );

    expect(holdings).toHaveLength(1);
    const h = holdings[0];
    expect(h.quantity.toString()).toBe("10");
    expect(h.costBasis.toString()).toBe("6000");
    expect(h.marketValue?.toString()).toBe("7000");
    expect(h.unrealizedPnL?.toString()).toBe("1000");
    expect(h.unrealizedPnLPercent?.toString()).toBe("0.16666666666666666667");
    expect(h.missingFx).toBe(false);
    expect(h.marketValueBase?.toString()).toBe("7000");
  });

  it("converts a foreign-currency holding to the portfolio base currency", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: aapl.id, type: "BUY", date: "2024-01-01", quantity: 5, price: 150, currency: "USD" }),
    ];
    const holdings = deriveHoldings(
      transactions,
      [aapl],
      new Map([[aapl.id, { securityId: aapl.id, price: d(180), currency: "USD", asOf: recentPriceDate }]]),
      [
        {
          baseCurrency: "USD",
          quoteCurrency: "EUR",
          date: new Date("2024-01-01"),
          rate: d("0.9"),
        },
      ],
      "EUR"
    );

    const h = holdings[0];
    // market value in USD = 5 * 180 = 900; converted at 0.9 -> 810 EUR
    expect(h.marketValue?.toString()).toBe("900");
    expect(h.marketValueBase?.toString()).toBe("810");
    expect(h.missingFx).toBe(false);
  });

  it("flags missingFx instead of guessing a conversion when no FX rate is available", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: aapl.id, type: "BUY", date: "2024-01-01", quantity: 5, price: 150, currency: "USD" }),
    ];
    const holdings = deriveHoldings(
      transactions,
      [aapl],
      new Map([[aapl.id, { securityId: aapl.id, price: d(180), currency: "USD", asOf: recentPriceDate }]]),
      [], // no fx rates at all
      "EUR"
    );

    const h = holdings[0];
    expect(h.missingFx).toBe(true);
    expect(h.marketValueBase).toBeNull();
  });

  it("flags a holding with no current price as stale, with null market value", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: asml.id, type: "BUY", date: "2024-01-01", quantity: 10, price: 600 }),
    ];
    const holdings = deriveHoldings(transactions, [asml], new Map(), [], "EUR");

    const h = holdings[0];
    expect(h.marketValue).toBeNull();
    expect(h.unrealizedPnL).toBeNull();
    expect(h.priceStale).toBe(true);
  });

  it("excludes fully-sold securities (quantity 0) from the holdings list", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: asml.id, type: "BUY", date: "2024-01-01", quantity: 10, price: 600 }),
      tx({ securityId: asml.id, type: "SELL", date: "2024-02-01", quantity: 10, price: 650 }),
    ];
    const holdings = deriveHoldings(transactions, [asml], new Map(), [], "EUR");
    expect(holdings).toHaveLength(0);
  });

  it("ignores cash transactions (null securityId) when deriving holdings", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: null, type: "DEPOSIT", date: "2024-01-01" }),
      tx({ securityId: asml.id, type: "BUY", date: "2024-01-02", quantity: 1, price: 600 }),
      tx({ securityId: null, type: "WITHDRAWAL", date: "2024-01-03" }),
    ];
    const holdings = deriveHoldings(transactions, [asml], new Map(), [], "EUR");
    expect(holdings).toHaveLength(1);
    expect(holdings[0].securityId).toBe(asml.id);
  });

  it("throws when a transaction references a security not passed in", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: "unknown-sec", type: "BUY", date: "2024-01-01", quantity: 1, price: 10 }),
    ];
    expect(() => deriveHoldings(transactions, [asml], new Map(), [], "EUR")).toThrow(
      /unknown security/
    );
  });
});

describe("calculatePortfolioValue", () => {
  it("sums holdings' base-currency market value plus cash balances", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: asml.id, type: "BUY", date: "2024-01-01", quantity: 10, price: 600 }),
    ];
    const holdings = deriveHoldings(
      transactions,
      [asml],
      new Map([[asml.id, { securityId: asml.id, price: d(650), currency: "EUR", asOf: recentPriceDate }]]),
      [],
      "EUR"
    );

    const value = calculatePortfolioValue(holdings, [d(1500)]);
    // holdings: 10 * 650 = 6500, + cash 1500 = 8000
    expect(value.toString()).toBe("8000");
  });

  it("treats a missing-FX holding as contributing 0, not throwing", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: aapl.id, type: "BUY", date: "2024-01-01", quantity: 5, price: 150, currency: "USD" }),
    ];
    const holdings = deriveHoldings(
      transactions,
      [aapl],
      new Map([[aapl.id, { securityId: aapl.id, price: d(180), currency: "USD", asOf: recentPriceDate }]]),
      [],
      "EUR"
    );

    expect(calculatePortfolioValue(holdings).toString()).toBe("0");
  });

  it("is zero for an empty portfolio", () => {
    expect(calculatePortfolioValue([]).toString()).toBe("0");
  });
});
