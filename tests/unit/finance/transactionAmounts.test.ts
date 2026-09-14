import { describe, expect, it } from "vitest";
import { computeTransactionAmounts } from "@/lib/finance/transactionAmounts";
import { d } from "./helpers";

const base = { quantity: null, price: null, amount: null, fees: d(0), taxes: d(0) };

describe("computeTransactionAmounts", () => {
  it("BUY: gross = qty*price, net includes fees+taxes", () => {
    const result = computeTransactionAmounts({
      ...base,
      type: "BUY",
      quantity: d(10),
      price: d(200),
      fees: d(5),
      taxes: d(1),
    });
    expect(result.grossAmount.toString()).toBe("2000");
    expect(result.netAmount.toString()).toBe("2006");
  });

  it("SELL: gross = qty*price, net subtracts fees+taxes (proceeds)", () => {
    const result = computeTransactionAmounts({
      ...base,
      type: "SELL",
      quantity: d(10),
      price: d(200),
      fees: d(5),
      taxes: d(1),
    });
    expect(result.grossAmount.toString()).toBe("2000");
    expect(result.netAmount.toString()).toBe("1994");
  });

  it("DIVIDEND: net = gross - withholding tax", () => {
    const result = computeTransactionAmounts({
      ...base,
      type: "DIVIDEND",
      amount: d(100),
      taxes: d(15),
    });
    expect(result.grossAmount.toString()).toBe("100");
    expect(result.netAmount.toString()).toBe("85");
  });

  it("DEPOSIT: gross = net = amount when there are no fees", () => {
    const result = computeTransactionAmounts({ ...base, type: "DEPOSIT", amount: d(1000) });
    expect(result.grossAmount.toString()).toBe("1000");
    expect(result.netAmount.toString()).toBe("1000");
  });

  it("FEE: gross = net = amount, unaffected by the fees/taxes fields", () => {
    const result = computeTransactionAmounts({
      ...base,
      type: "FEE",
      amount: d(12.5),
      fees: d(99),
    });
    expect(result.grossAmount.toString()).toBe("12.5");
    expect(result.netAmount.toString()).toBe("12.5");
  });

  it("SPLIT: gross = net = 0, informational only", () => {
    const result = computeTransactionAmounts({ ...base, type: "SPLIT" });
    expect(result.grossAmount.toString()).toBe("0");
    expect(result.netAmount.toString()).toBe("0");
  });

  it("throws for BUY missing quantity or price", () => {
    expect(() =>
      computeTransactionAmounts({ ...base, type: "BUY", quantity: d(1) })
    ).toThrow(/requires both quantity and price/);
  });

  it("throws for DIVIDEND missing an amount", () => {
    expect(() => computeTransactionAmounts({ ...base, type: "DIVIDEND" })).toThrow(
      /requires an amount/
    );
  });
});
