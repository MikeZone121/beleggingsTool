import { describe, expect, it } from "vitest";
import type { DividendCashflow } from "@/types/domain";
import {
  toDividendCashflow,
  groupIncomeByPeriod,
  calculateTrailingTwelveMonthIncome,
  calculateDividendYield,
  calculateDividendGrowth,
} from "@/lib/finance/dividendMetrics";
import { d, resetSequence, tx } from "./helpers";

function cf(
  date: string,
  netAmountBase: number | null,
  overrides: Partial<DividendCashflow> = {}
): DividendCashflow {
  return {
    securityId: "asml",
    transactionId: `cf-${date}`,
    date: new Date(date),
    grossAmount: d(netAmountBase ?? 0),
    taxes: d(0),
    netAmount: d(netAmountBase ?? 0),
    currency: "EUR",
    netAmountBase: netAmountBase === null ? null : d(netAmountBase),
    ...overrides,
  };
}

describe("toDividendCashflow", () => {
  it("maps a DIVIDEND transaction, converting via its own historical rate", () => {
    resetSequence();
    const t = {
      ...tx({ type: "DIVIDEND", date: "2024-03-01", currency: "USD", securityId: "aapl" }),
      grossAmount: d(100),
      netAmount: d(85),
      taxes: d(15),
    };
    const result = toDividendCashflow(t, {
      baseCurrency: "EUR",
      fxRates: [{ baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2024-01-01"), rate: d("0.9") }],
    });
    expect(result?.netAmount.toString()).toBe("85");
    expect(result?.netAmountBase?.toString()).toBe("76.5"); // 85 * 0.9
  });

  it("returns null for non-DIVIDEND transactions", () => {
    resetSequence();
    const t = tx({ type: "BUY", date: "2024-01-01", quantity: 1, price: 100 });
    expect(toDividendCashflow(t)).toBeNull();
  });

  it("returns netAmountBase: null when no fxContext is given", () => {
    resetSequence();
    const t = tx({ type: "DIVIDEND", date: "2024-01-01" });
    const result = toDividendCashflow(t);
    expect(result?.netAmountBase).toBeNull();
  });
});

describe("groupIncomeByPeriod", () => {
  const cashflows = [
    cf("2023-01-15", 10),
    cf("2023-02-15", 20),
    cf("2024-01-15", 30),
  ];

  it("groups by month", () => {
    const result = groupIncomeByPeriod(cashflows, "month");
    expect(result.map((p) => p.periodKey)).toEqual(["2023-01", "2023-02", "2024-01"]);
    expect(result[0].income.toString()).toBe("10");
  });

  it("groups by year", () => {
    const result = groupIncomeByPeriod(cashflows, "year");
    expect(result.map((p) => p.periodKey)).toEqual(["2023", "2024"]);
    expect(result[0].income.toString()).toBe("30"); // 10 + 20
    expect(result[1].income.toString()).toBe("30");
  });

  it("flags a period with missing FX rather than dropping it", () => {
    const result = groupIncomeByPeriod([cf("2023-01-15", null), cf("2023-01-20", 10)], "month");
    expect(result[0].hasMissingFx).toBe(true);
    expect(result[0].income.toString()).toBe("10"); // partial total, still flagged
  });
});

describe("calculateTrailingTwelveMonthIncome", () => {
  it("sums only cashflows within the trailing 365 days", () => {
    const cashflows = [
      cf("2023-06-01", 100), // outside window
      cf("2024-01-01", 50), // inside window
      cf("2024-06-01", 25), // inside window (asOf)
    ];
    const result = calculateTrailingTwelveMonthIncome(cashflows, new Date("2024-06-01"));
    expect(result.total.toString()).toBe("75");
    expect(result.hasMissingFx).toBe(false);
  });

  it("flags hasMissingFx when any in-window cashflow lacks a base amount", () => {
    const cashflows = [cf("2024-01-01", null)];
    const result = calculateTrailingTwelveMonthIncome(cashflows, new Date("2024-06-01"));
    expect(result.hasMissingFx).toBe(true);
    expect(result.total.toString()).toBe("0");
  });
});

describe("calculateDividendYield", () => {
  const cashflows = [cf("2024-01-01", 100)];

  it("computes current yield and yield-on-cost from TTM income", () => {
    const result = calculateDividendYield(
      "asml",
      cashflows,
      d(5000), // market value
      d(4000), // cost basis
      new Date("2024-06-01")
    );
    expect(result.currentYield?.toString()).toBe("0.02"); // 100/5000
    expect(result.yieldOnCost?.toString()).toBe("0.025"); // 100/4000
  });

  it("returns null instead of dividing by a missing denominator", () => {
    const result = calculateDividendYield("asml", cashflows, null, null, new Date("2024-06-01"));
    expect(result.currentYield).toBeNull();
    expect(result.yieldOnCost).toBeNull();
  });

  it("returns null when TTM income itself has missing FX data", () => {
    const result = calculateDividendYield(
      "asml",
      [cf("2024-01-01", null)],
      d(5000),
      d(4000),
      new Date("2024-06-01")
    );
    expect(result.currentYield).toBeNull();
    expect(result.yieldOnCost).toBeNull();
  });
});

describe("calculateDividendGrowth", () => {
  it("computes YoY growth and CAGR across full years, excluding the current year", () => {
    const cashflows = [
      cf("2021-06-01", 100),
      cf("2022-06-01", 110),
      cf("2023-06-01", 121),
      cf("2024-06-01", 999), // current year — excluded
    ];
    const result = calculateDividendGrowth("asml", cashflows, new Date("2024-08-01"));

    expect(result.incomeByYear.map((y) => y.year)).toEqual([2021, 2022, 2023]);
    expect(result.yoyGrowth[0].growth).toBeNull(); // no prior year
    expect(result.yoyGrowth[1].growth?.toString()).toBe("0.1"); // (110-100)/100
    expect(result.yoyGrowth[2].growth?.toString()).toBe("0.1"); // (121-110)/110

    // CAGR over 2021->2023 (2 years): (121/100)^(1/2) - 1 = 0.1
    expect(result.cagr?.toDecimalPlaces(4).toString()).toBe("0.1");
  });

  it("returns null CAGR with fewer than 2 full years of history", () => {
    const result = calculateDividendGrowth("asml", [cf("2024-01-01", 100)], new Date("2024-06-01"));
    expect(result.incomeByYear).toHaveLength(0); // 2024 is the current year, excluded
    expect(result.cagr).toBeNull();
  });

  it("does not fabricate CAGR when income went to zero or negative", () => {
    const cashflows = [cf("2021-06-01", 100), cf("2022-06-01", 0)];
    const result = calculateDividendGrowth("asml", cashflows, new Date("2024-01-01"));
    expect(result.cagr).toBeNull();
  });
});
