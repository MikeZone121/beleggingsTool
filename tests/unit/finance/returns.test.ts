import { describe, expect, it } from "vitest";
import { calculateXIRR, calculateTotalReturn } from "@/lib/finance/returns";
import { d } from "./helpers";

function flow(date: string, amount: number) {
  return { date: new Date(date), amount: d(amount) };
}

describe("calculateXIRR", () => {
  it("solves a simple one-year round trip: -1000 -> +1100 = 10%", () => {
    const rate = calculateXIRR([flow("2023-01-01", -1000), flow("2024-01-01", 1100)]);
    expect(rate?.toNumber()).toBeCloseTo(0.1, 3);
  });

  it("solves a known two-deposit, two-year scenario via closed-form algebra", () => {
    // -1000 at t=0, -1000 at t=1yr, +2200 at t=2yr.
    // 2200x^2 - 1000x - 1000 = 0 (x = 1/(1+r)) -> x = (5+sqrt(245))/22
    // -> r ~= 0.065274
    const rate = calculateXIRR([
      flow("2022-01-01", -1000),
      flow("2023-01-01", -1000),
      flow("2024-01-01", 2200),
    ]);
    expect(rate?.toNumber()).toBeCloseTo(0.065274, 4);
  });

  it("handles a deposit, a mid-period withdrawal, and a terminal value", () => {
    // Invest 10000, withdraw 3000 six months later, end with 8500 a year in.
    const rate = calculateXIRR([
      flow("2023-01-01", -10000),
      flow("2023-07-01", 3000),
      flow("2024-01-01", 8500),
    ]);
    expect(rate).not.toBeNull();
    expect(rate!.isFinite()).toBe(true);
  });

  it("returns null when there's no sign change (no real investment/return pair)", () => {
    expect(calculateXIRR([flow("2023-01-01", 100), flow("2024-01-01", 200)])).toBeNull();
    expect(calculateXIRR([flow("2023-01-01", -100), flow("2024-01-01", -200)])).toBeNull();
  });

  it("returns null for fewer than 2 cash flows", () => {
    expect(calculateXIRR([flow("2023-01-01", -1000)])).toBeNull();
    expect(calculateXIRR([])).toBeNull();
  });

  it("ignores zero-amount cash flows when checking computability", () => {
    const rate = calculateXIRR([
      flow("2023-01-01", -1000),
      flow("2023-06-01", 0),
      flow("2024-01-01", 1100),
    ]);
    expect(rate?.toNumber()).toBeCloseTo(0.1, 3);
  });

  it("is deterministic: same input always produces the same output", () => {
    const cashflows = [flow("2023-01-01", -5000), flow("2023-09-01", 1200), flow("2024-03-01", 4500)];
    const a = calculateXIRR(cashflows);
    const b = calculateXIRR(cashflows);
    expect(a?.toNumber()).toBe(b?.toNumber());
  });
});

describe("calculateTotalReturn", () => {
  it("computes a positive total return with no external cash flow", () => {
    const result = calculateTotalReturn(d(10000), d(12000), d(0));
    expect(result?.toString()).toBe("0.2");
  });

  it("accounts for a mid-period deposit so it isn't misread as return", () => {
    // Start 10000, deposit another 5000, end at 16000.
    // Capital at risk = 15000; return = (16000-15000)/15000 = 0.0667
    const result = calculateTotalReturn(d(10000), d(16000), d(5000));
    expect(result?.toDecimalPlaces(4).toString()).toBe("0.0667");
  });

  it("returns null when there is no capital at risk", () => {
    expect(calculateTotalReturn(d(0), d(1000), d(0))).toBeNull();
  });

  it("supports a negative return", () => {
    const result = calculateTotalReturn(d(10000), d(9000), d(0));
    expect(result?.toString()).toBe("-0.1");
  });
});
