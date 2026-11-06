import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  defaultTobCategory,
  estimateBelgianTransactionTax,
  TOB_RATES,
} from "@/lib/finance/belgianTransactionTax";

describe("estimateBelgianTransactionTax", () => {
  it("applies 0.35% to a share trade", () => {
    const result = estimateBelgianTransactionTax(new Decimal("10000"), "SHARES");
    expect(result.amount.toString()).toBe("35");
    expect(result.capped).toBe(false);
  });

  it("applies 0.12% to a bond trade", () => {
    expect(estimateBelgianTransactionTax(new Decimal("10000"), "BONDS").amount.toString()).toBe(
      "12"
    );
  });

  it("applies 1.32% to a Belgian-registered accumulating fund", () => {
    expect(
      estimateBelgianTransactionTax(new Decimal("10000"), "FUND_BE_ACCUMULATING").amount.toString()
    ).toBe("132");
  });

  it("treats a foreign ETF as the 0.35% category, not the 1.32% one", () => {
    const foreign = estimateBelgianTransactionTax(new Decimal("5000"), "FUND_FOREIGN");
    expect(foreign.amount.toString()).toBe("17.5");
  });

  it("caps the tax per transaction instead of scaling with the amount", () => {
    // 0.35% of 1,000,000 would be 3,500 — over the 1,600 cap.
    const result = estimateBelgianTransactionTax(new Decimal("1000000"), "SHARES");
    expect(result.amount.toString()).toBe("1600");
    expect(result.capped).toBe(true);
  });

  it("rounds to cents the way the tax is actually charged", () => {
    // 0.35% of 1,234.56 = 4.32096
    expect(estimateBelgianTransactionTax(new Decimal("1234.56"), "SHARES").amount.toString()).toBe(
      "4.32"
    );
  });

  it("is zero for categories outside the TOB", () => {
    const result = estimateBelgianTransactionTax(new Decimal("10000"), "NONE");
    expect(result.amount.isZero()).toBe(true);
    expect(result.capped).toBe(false);
  });

  it("never returns negative tax for a negative gross amount", () => {
    const result = estimateBelgianTransactionTax(new Decimal("-10000"), "SHARES");
    expect(result.amount.toString()).toBe("35");
  });

  it("keeps every rate and cap in one table, so a rate change is one edit", () => {
    expect(TOB_RATES.SHARES.rate.toString()).toBe("0.0035");
    expect(TOB_RATES.SHARES.capPerTransaction?.toString()).toBe("1600");
    expect(TOB_RATES.NONE.capPerTransaction).toBeNull();
  });
});

describe("defaultTobCategory", () => {
  it("maps the asset types the app stores onto a starting category", () => {
    expect(defaultTobCategory("STOCK")).toBe("SHARES");
    expect(defaultTobCategory("BOND")).toBe("BONDS");
    expect(defaultTobCategory("ETF")).toBe("FUND_FOREIGN");
    expect(defaultTobCategory("FUND")).toBe("FUND_FOREIGN");
    expect(defaultTobCategory("CRYPTO")).toBe("NONE");
    expect(defaultTobCategory("CASH")).toBe("NONE");
    expect(defaultTobCategory("OTHER")).toBe("NONE");
  });
});
