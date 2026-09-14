import { describe, expect, it } from "vitest";
import { convertToBase, findFxRate } from "@/lib/finance/currency";
import { d } from "./helpers";

const rates = [
  { baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2024-01-01"), rate: d("0.90") },
  { baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2024-03-01"), rate: d("0.92") },
];

describe("currency conversion", () => {
  it("returns rate 1 when currencies match", () => {
    expect(findFxRate([], "EUR", "EUR", new Date("2024-05-01"))?.toString()).toBe("1");
  });

  it("finds the exact-date rate when available", () => {
    const rate = findFxRate(rates, "USD", "EUR", new Date("2024-03-01"));
    expect(rate?.toString()).toBe("0.92");
  });

  it("falls back to the nearest PRIOR date (never a future rate)", () => {
    // 2024-02-15 has no exact rate; nearest prior is 2024-01-01, not the
    // later (future-relative) 2024-03-01 rate.
    const rate = findFxRate(rates, "USD", "EUR", new Date("2024-02-15"));
    expect(rate?.toString()).toBe("0.9");
  });

  it("returns null (never guesses) when no prior rate exists", () => {
    const rate = findFxRate(rates, "USD", "EUR", new Date("2023-12-31"));
    expect(rate).toBeNull();
  });

  it("converts an amount using the resolved rate", () => {
    const result = convertToBase(d(100), "USD", "EUR", new Date("2024-03-01"), rates);
    expect(result?.toString()).toBe("92");
  });

  it("returns null instead of a wrong conversion when FX data is missing", () => {
    const result = convertToBase(d(100), "USD", "GBP", new Date("2024-03-01"), rates);
    expect(result).toBeNull();
  });
});
