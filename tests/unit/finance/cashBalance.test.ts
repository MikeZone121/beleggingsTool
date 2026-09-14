import { describe, expect, it } from "vitest";
import { calculateCashBalance } from "@/lib/finance/cashBalance";
import { d, resetSequence, tx } from "./helpers";

const fxContext = { baseCurrency: "EUR", fxRates: [] };

/** Builds a transaction with an explicit netAmount, bypassing the helper's
 * quantity*price derivation (irrelevant for cash-type transactions). */
function cashTx(type: Parameters<typeof tx>[0]["type"], date: string, netAmount: number) {
  return { ...tx({ type, date, securityId: null }), netAmount: d(netAmount) };
}

describe("calculateCashBalance", () => {
  it("is zero for an empty transaction list", () => {
    expect(calculateCashBalance([], fxContext).balanceBase.toString()).toBe("0");
  });

  it("adds deposits and subtracts withdrawals", () => {
    resetSequence();
    const result = calculateCashBalance(
      [cashTx("DEPOSIT", "2024-01-01", 20000), cashTx("WITHDRAWAL", "2024-06-01", 5000)],
      fxContext
    );
    expect(result.balanceBase.toString()).toBe("15000");
  });

  it("nets out a full lifecycle: deposit, buy, sell, dividend, fee, withdrawal", () => {
    resetSequence();
    const result = calculateCashBalance(
      [
        cashTx("DEPOSIT", "2024-01-01", 20000),
        cashTx("BUY", "2024-01-02", 5810), // cash out
        cashTx("SELL", "2024-06-01", 1945), // cash in
        cashTx("DIVIDEND", "2024-06-15", 20.82),
        cashTx("FEE", "2024-07-01", 10),
        cashTx("WITHDRAWAL", "2024-08-01", 1000),
      ],
      fxContext
    );
    // 20000 - 5810 + 1945 + 20.82 - 10 - 1000 = 15145.82
    expect(result.balanceBase.toString()).toBe("15145.82");
  });

  it("converts foreign-currency cash transactions using their own historical rate", () => {
    resetSequence();
    const usdBuy = {
      ...cashTx("BUY", "2024-01-01", 1000),
      currency: "USD",
    };
    const result = calculateCashBalance(
      [usdBuy],
      {
        baseCurrency: "EUR",
        fxRates: [{ baseCurrency: "USD", quoteCurrency: "EUR", date: new Date("2024-01-01"), rate: d("0.9") }],
      }
    );
    expect(result.balanceBase.toString()).toBe("-900");
    expect(result.hasMissingFx).toBe(false);
  });

  it("flags hasMissingFx and excludes that transaction from the total, rather than guessing", () => {
    resetSequence();
    const usdBuy = { ...cashTx("BUY", "2024-01-01", 1000), currency: "USD" };
    const result = calculateCashBalance([usdBuy, cashTx("DEPOSIT", "2024-01-01", 500)], fxContext);
    expect(result.hasMissingFx).toBe(true);
    expect(result.balanceBase.toString()).toBe("500"); // only the resolvable EUR deposit
  });

  it("flags TRANSFER/OTHER transactions as excluded rather than guessing a sign", () => {
    resetSequence();
    const result = calculateCashBalance([cashTx("TRANSFER", "2024-01-01", 100)], fxContext);
    expect(result.hasExcludedTransactions).toBe(true);
    expect(result.balanceBase.toString()).toBe("0");
  });

  it("ignores SPLIT transactions (no cash impact)", () => {
    resetSequence();
    const result = calculateCashBalance([cashTx("SPLIT", "2024-01-01", 0)], fxContext);
    expect(result.hasExcludedTransactions).toBe(false);
    expect(result.balanceBase.toString()).toBe("0");
  });
});
