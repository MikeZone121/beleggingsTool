import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import { ratioOf, roundCurrency, roundQuantity, sum, ZERO } from "@/lib/finance/money";

describe("money", () => {
  it("sums a list of decimals without floating point drift", () => {
    const values = [new Decimal("0.1"), new Decimal("0.2"), new Decimal("0.3")];
    expect(sum(values).toString()).toBe("0.6");
  });

  it("returns ZERO for an empty sum", () => {
    expect(sum([]).equals(ZERO)).toBe(true);
  });

  it("computes a ratio", () => {
    const result = ratioOf(new Decimal(25), new Decimal(200));
    expect(result?.toString()).toBe("0.125");
  });

  it("returns null instead of dividing by zero", () => {
    expect(ratioOf(new Decimal(10), ZERO)).toBeNull();
  });

  it("rounds currency to 2 decimal places, half-up", () => {
    expect(roundCurrency(new Decimal("10.005")).toString()).toBe("10.01");
    expect(roundCurrency(new Decimal("10.004")).toString()).toBe("10");
  });

  it("rounds quantity to 8 decimal places", () => {
    expect(roundQuantity(new Decimal("1.123456789")).toString()).toBe("1.12345679");
  });
});
