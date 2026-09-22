import { describe, expect, it } from "vitest";
import { computeAverageCostLedger } from "@/lib/finance/costBasis";
import { d, resetSequence, tx } from "./helpers";

describe("computeAverageCostLedger (average cost method)", () => {
  it("BUY 10 @ $200 -> quantity 10, cost basis $2,000", () => {
    resetSequence();
    const result = computeAverageCostLedger("sec-1", [
      tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 200 }),
    ]);

    expect(result.quantity.toString()).toBe("10");
    expect(result.costBasis.toString()).toBe("2000");
    expect(result.averageCost?.toString()).toBe("200");
    expect(result.realizedGains).toHaveLength(0);
  });

  it("BUY then partial SELL leaves the correct remaining quantity and realized P&L", () => {
    resetSequence();
    // BUY 10 @ $200 = $2,000 cost basis, then SELL 4 @ $250
    const result = computeAverageCostLedger("sec-1", [
      tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 200 }),
      tx({ type: "SELL", date: "2024-06-01", quantity: 4, price: 250 }),
    ]);

    // remaining quantity = 6
    expect(result.quantity.toString()).toBe("6");
    // cost basis removed = avgCost(200) * 4 = 800; remaining cost basis = 1200
    expect(result.costBasis.toString()).toBe("1200");
    expect(result.averageCost?.toString()).toBe("200");

    expect(result.realizedGains).toHaveLength(1);
    const gain = result.realizedGains[0];
    // proceeds = 4 * 250 = 1000; cost basis removed = 800; P&L = 200
    expect(gain.proceeds.toString()).toBe("1000");
    expect(gain.costBasisRemoved.toString()).toBe("800");
    expect(gain.realizedPnL.toString()).toBe("200");
  });

  it("averages cost across multiple buys at different prices", () => {
    resetSequence();
    const result = computeAverageCostLedger("sec-1", [
      tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
      tx({ type: "BUY", date: "2024-02-01", quantity: 10, price: 200 }),
    ]);

    // total cost = 1000 + 2000 = 3000, quantity = 20, avg = 150
    expect(result.quantity.toString()).toBe("20");
    expect(result.costBasis.toString()).toBe("3000");
    expect(result.averageCost?.toString()).toBe("150");
  });

  it("includes buy fees/taxes in cost basis and subtracts sell fees/taxes from proceeds", () => {
    resetSequence();
    const result = computeAverageCostLedger("sec-1", [
      tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100, fees: 10 }),
      tx({ type: "SELL", date: "2024-02-01", quantity: 10, price: 120, fees: 5, taxes: 3 }),
    ]);

    // cost basis = 10*100 + 10 = 1010; avg cost = 101
    // proceeds = 10*120 - 5 - 3 = 1192; realizedPnL = 1192 - 1010 = 182
    expect(result.realizedGains[0].proceeds.toString()).toBe("1192");
    expect(result.realizedGains[0].costBasisRemoved.toString()).toBe("1010");
    expect(result.realizedGains[0].realizedPnL.toString()).toBe("182");
    expect(result.quantity.toString()).toBe("0");
    expect(result.costBasis.toString()).toBe("0");
  });

  it("fully sold position: quantity and cost basis go to zero, average cost is null", () => {
    resetSequence();
    const result = computeAverageCostLedger("sec-1", [
      tx({ type: "BUY", date: "2024-01-01", quantity: 5, price: 50 }),
      tx({ type: "SELL", date: "2024-02-01", quantity: 5, price: 60 }),
    ]);

    expect(result.quantity.toString()).toBe("0");
    expect(result.costBasis.toString()).toBe("0");
    expect(result.averageCost).toBeNull();
  });

  it("supports a negative realized P&L (a loss)", () => {
    resetSequence();
    const result = computeAverageCostLedger("sec-1", [
      tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
      tx({ type: "SELL", date: "2024-02-01", quantity: 10, price: 60 }),
    ]);

    expect(result.realizedGains[0].realizedPnL.toString()).toBe("-400");
  });

  it("dividends and cash transactions do not affect the cost-basis ledger", () => {
    resetSequence();
    const result = computeAverageCostLedger("sec-1", [
      tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
      tx({
        type: "DIVIDEND",
        date: "2024-03-01",
        securityId: "sec-1",
        quantity: undefined,
        price: undefined,
      }),
    ]);

    expect(result.quantity.toString()).toBe("10");
    expect(result.costBasis.toString()).toBe("1000");
    expect(result.realizedGains).toHaveLength(0);
  });

  it("dividends received after a partial sale still leave the correct remaining position", () => {
    resetSequence();
    const result = computeAverageCostLedger("sec-1", [
      tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
      tx({ type: "SELL", date: "2024-02-01", quantity: 4, price: 120 }),
      tx({ type: "DIVIDEND", date: "2024-03-01" }),
    ]);

    expect(result.quantity.toString()).toBe("6");
    expect(result.costBasis.toString()).toBe("600");
  });

  it("orders same-day transactions deterministically via `sequence`", () => {
    resetSequence();
    // Two BUYs on the same date; sequence (insertion order) breaks the tie.
    const result = computeAverageCostLedger("sec-1", [
      tx({ type: "BUY", date: "2024-01-01", quantity: 5, price: 100 }),
      tx({ type: "BUY", date: "2024-01-01", quantity: 5, price: 200 }),
    ]);

    expect(result.quantity.toString()).toBe("10");
    expect(result.costBasis.toString()).toBe("1500");
  });

  it("throws when selling more shares than currently held", () => {
    resetSequence();
    expect(() =>
      computeAverageCostLedger("sec-1", [
        tx({ type: "BUY", date: "2024-01-01", quantity: 5, price: 100 }),
        tx({ type: "SELL", date: "2024-02-01", quantity: 10, price: 120 }),
      ])
    ).toThrow(/Cannot sell/);
  });

  it("applies a 2:1 split: quantity doubles, cost basis unchanged, average cost halves", () => {
    resetSequence();
    const result = computeAverageCostLedger(
      "sec-1",
      [tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 })],
      [{ securityId: "sec-1", effectiveDate: new Date("2024-06-01"), ratio: d(2) }]
    );

    expect(result.quantity.toString()).toBe("20");
    expect(result.costBasis.toString()).toBe("1000");
    expect(result.averageCost?.toString()).toBe("50");
  });

  it("applies a split before same-day trades", () => {
    resetSequence();
    // BUY 10 @ 100 on day 1. On day 2: a 2:1 split, then a SELL of 15 shares
    // (only possible if the split is applied before the same-day sell).
    const result = computeAverageCostLedger(
      "sec-1",
      [
        tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
        tx({ type: "SELL", date: "2024-01-02", quantity: 15, price: 60 }),
      ],
      [{ securityId: "sec-1", effectiveDate: new Date("2024-01-02"), ratio: d(2) }]
    );

    // post-split: quantity 20, avg cost 50. Sell 15 @ 60.
    expect(result.quantity.toString()).toBe("5");
    const gain = result.realizedGains[0];
    expect(gain.costBasisRemoved.toString()).toBe("750"); // 15 * 50
    expect(gain.proceeds.toString()).toBe("900"); // 15 * 60
    expect(gain.realizedPnL.toString()).toBe("150");
  });

  it("handles a zero-quantity edge case without dividing by zero", () => {
    resetSequence();
    const result = computeAverageCostLedger("sec-1", []);
    expect(result.quantity.toString()).toBe("0");
    expect(result.costBasis.toString()).toBe("0");
    expect(result.averageCost).toBeNull();
  });

  it("throws a descriptive error for a BUY/SELL missing quantity or price", () => {
    resetSequence();
    expect(() =>
      computeAverageCostLedger("sec-1", [
        tx({ type: "BUY", date: "2024-01-01", quantity: undefined, price: undefined }),
      ])
    ).toThrow(/missing quantity or price/);
  });
});

describe("computeAverageCostLedger base-currency (fxContext) tracking", () => {
  it("converts cost basis using each transaction's own historical rate, not the latest one", () => {
    resetSequence();
    // Two BUYs of a USD security at different historical EUR/USD rates.
    const result = computeAverageCostLedger(
      "aapl",
      [
        tx({ type: "BUY", date: "2023-01-01", quantity: 10, price: 100, currency: "USD" }),
        tx({ type: "BUY", date: "2023-06-01", quantity: 10, price: 100, currency: "USD" }),
      ],
      [],
      {
        baseCurrency: "EUR",
        fxRates: [
          { baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2023-01-01"), rate: d("0.90") },
          { baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2023-06-01"), rate: d("0.95") },
        ],
      }
    );

    // Native cost basis: 10*100 + 10*100 = 2000 USD.
    expect(result.costBasis.toString()).toBe("2000");
    // Base cost basis: (1000 * 0.90) + (1000 * 0.95) = 1850 EUR — NOT
    // 2000 * (today's/latest rate), which would be a bug.
    expect(result.costBasisBase?.toString()).toBe("1850");
  });

  it("uses the transaction's own recorded exchangeRate over a historical lookup when present", () => {
    resetSequence();
    const result = computeAverageCostLedger(
      "aapl",
      [tx({ type: "BUY", date: "2023-01-01", quantity: 10, price: 100, currency: "USD" })],
      [],
      { baseCurrency: "EUR", fxRates: [] }
    );
    // No fx rate table entry and no tx.exchangeRate (helper defaults it to
    // null) -> base cost basis is unresolvable.
    expect(result.costBasisBase).toBeNull();
  });

  it("a missing FX rate poisons costBasisBase (null) rather than silently treating it as 0 or 1", () => {
    resetSequence();
    const result = computeAverageCostLedger(
      "aapl",
      [
        // Dated before any available rate — "nearest PRIOR date" correctly
        // finds nothing (it must never look forward), so this BUY's rate is
        // unresolvable.
        tx({ type: "BUY", date: "2022-01-01", quantity: 10, price: 100, currency: "USD" }),
        tx({ type: "BUY", date: "2023-06-01", quantity: 10, price: 100, currency: "USD" }),
      ],
      [],
      {
        baseCurrency: "EUR",
        fxRates: [
          { baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2023-01-01"), rate: d("0.90") },
        ],
      }
    );

    expect(result.costBasisBase).toBeNull();
    expect(result.averageCostBase).toBeNull();
  });

  it("computes realizedPnLBase for a sale using historical rates for both the buy and the sell", () => {
    resetSequence();
    const result = computeAverageCostLedger(
      "aapl",
      [
        tx({ type: "BUY", date: "2023-01-01", quantity: 10, price: 100, currency: "USD" }),
        tx({ type: "SELL", date: "2023-06-01", quantity: 4, price: 150, currency: "USD" }),
      ],
      [],
      {
        baseCurrency: "EUR",
        fxRates: [
          { baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2023-01-01"), rate: d("0.90") },
          { baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2023-06-01"), rate: d("0.95") },
        ],
      }
    );

    // native: avgCost 100, costBasisRemoved 400, proceeds 600, pnl 200.
    const gain = result.realizedGains[0];
    expect(gain.realizedPnL.toString()).toBe("200");
    // base: costBasisRemovedBase = 400 * 0.90 = 360; proceedsBase = 600*0.95=570
    expect(gain.costBasisRemovedBase?.toString()).toBe("360");
    expect(gain.proceedsBase?.toString()).toBe("570");
    expect(gain.realizedPnLBase?.toString()).toBe("210");
  });

  it("skips FX conversion entirely (rate 1) when the transaction currency matches the base currency", () => {
    resetSequence();
    const result = computeAverageCostLedger(
      "asml",
      [tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100, currency: "EUR" })],
      [],
      { baseCurrency: "EUR", fxRates: [] }
    );
    expect(result.costBasisBase?.toString()).toBe("1000");
  });

  it("does not compute base-currency fields at all when no fxContext is given", () => {
    resetSequence();
    const result = computeAverageCostLedger("aapl", [
      tx({ type: "BUY", date: "2023-01-01", quantity: 10, price: 100 }),
    ]);
    expect(result.costBasisBase).toBeNull();
    expect(result.averageCostBase).toBeNull();
    expect(result.realizedGains).toHaveLength(0);
  });
});

describe("computeAverageCostLedger determinism", () => {
  it("is a pure function: same input always produces the same output", () => {
    resetSequence();
    const transactions = [
      tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
      tx({ type: "SELL", date: "2024-02-01", quantity: 3, price: 120 }),
    ];

    const a = computeAverageCostLedger("sec-1", transactions);
    const b = computeAverageCostLedger("sec-1", transactions);

    expect(a.quantity.equals(b.quantity)).toBe(true);
    expect(a.costBasis.equals(b.costBasis)).toBe(true);
    expect(a.realizedGains[0].realizedPnL.equals(b.realizedGains[0].realizedPnL)).toBe(true);
  });
});

describe("computeAverageCostLedger fiscal step-up", () => {
  const STEP_UP_DATE = new Date("2026-01-01");

  it("re-bases the position held on the step-up date without touching quantity", () => {
    resetSequence();
    const result = computeAverageCostLedger(
      "sec-1",
      [tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 })],
      [],
      undefined,
      { effectiveDate: STEP_UP_DATE, pricePerShare: d(150), pricePerShareBase: null }
    );

    expect(result.quantity.toString()).toBe("10");
    expect(result.costBasis.toString()).toBe("1500");
    expect(result.averageCost?.toString()).toBe("150");
  });

  it("measures a later sale against the stepped-up basis, not what was paid", () => {
    resetSequence();
    const transactions = [
      tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
      tx({ type: "SELL", date: "2026-06-01", quantity: 10, price: 170 }),
    ];

    const accounting = computeAverageCostLedger("sec-1", transactions);
    const fiscal = computeAverageCostLedger("sec-1", transactions, [], undefined, {
      effectiveDate: STEP_UP_DATE,
      pricePerShare: d(150),
      pricePerShareBase: null,
    });

    expect(accounting.realizedGains[0].realizedPnL.toString()).toBe("700");
    expect(fiscal.realizedGains[0].realizedPnL.toString()).toBe("200");
  });

  it("blends a post-step-up purchase into the stepped-up average", () => {
    resetSequence();
    const result = computeAverageCostLedger(
      "sec-1",
      [
        tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
        tx({ type: "BUY", date: "2026-02-01", quantity: 10, price: 250 }),
        tx({ type: "SELL", date: "2026-06-01", quantity: 20, price: 300 }),
      ],
      [],
      undefined,
      { effectiveDate: STEP_UP_DATE, pricePerShare: d(150), pricePerShareBase: null }
    );

    // (10 * 150 + 10 * 250) / 20 = 200 per share.
    expect(result.realizedGains[0].costBasisRemoved.toString()).toBe("4000");
    expect(result.realizedGains[0].realizedPnL.toString()).toBe("2000");
  });

  it("leaves a position opened after the step-up date alone", () => {
    resetSequence();
    const result = computeAverageCostLedger(
      "sec-1",
      [
        tx({ type: "BUY", date: "2026-03-01", quantity: 5, price: 80 }),
        tx({ type: "SELL", date: "2026-09-01", quantity: 5, price: 100 }),
      ],
      [],
      undefined,
      { effectiveDate: STEP_UP_DATE, pricePerShare: d(150), pricePerShareBase: null }
    );

    expect(result.realizedGains[0].realizedPnL.toString()).toBe("100");
  });

  it("steps up before a split effective the same day", () => {
    resetSequence();
    const result = computeAverageCostLedger(
      "sec-1",
      [
        tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
        tx({ type: "SELL", date: "2026-06-01", quantity: 20, price: 100 }),
      ],
      [{ securityId: "sec-1", effectiveDate: STEP_UP_DATE, ratio: d(2) }],
      undefined,
      { effectiveDate: STEP_UP_DATE, pricePerShare: d(150), pricePerShareBase: null }
    );

    // The 150 reference price is quoted pre-split, so the re-based total is
    // 10 * 150 = 1 500 and the split then halves it per share, not 20 * 150.
    expect(result.realizedGains[0].costBasisRemoved.toString()).toBe("1500");
    expect(result.realizedGains[0].realizedPnL.toString()).toBe("500");
  });

  it("converts the reference price with its own rate, and poisons base amounts without one", () => {
    resetSequence();
    const transactions = [
      tx({ type: "BUY", date: "2024-01-01", quantity: 10, price: 100, currency: "USD" }),
      tx({ type: "SELL", date: "2026-06-01", quantity: 10, price: 170, currency: "USD" }),
    ];
    const fxContext = {
      baseCurrency: "EUR",
      fxRates: [
        { baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2024-01-01"), rate: d("0.9") },
        { baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2026-06-01"), rate: d("0.8") },
      ],
    };

    const withRate = computeAverageCostLedger("sec-1", transactions, [], fxContext, {
      effectiveDate: STEP_UP_DATE,
      pricePerShare: d(150),
      pricePerShareBase: d("127.5"),
    });
    // Proceeds 1 700 USD at 0.8 = 1 360 EUR, basis 10 * 127.5 = 1 275 EUR.
    expect(withRate.realizedGains[0].realizedPnLBase?.toString()).toBe("85");

    const withoutRate = computeAverageCostLedger("sec-1", transactions, [], fxContext, {
      effectiveDate: STEP_UP_DATE,
      pricePerShare: d(150),
      pricePerShareBase: null,
    });
    expect(withoutRate.realizedGains[0].realizedPnLBase).toBeNull();
    expect(withoutRate.costBasisBase).toBeNull();
  });
});
