import { describe, expect, it } from "vitest";
import { calculateRealizedGains, totalRealizedPnL } from "@/lib/finance/realizedPnL";
import { resetSequence, tx } from "./helpers";

describe("calculateRealizedGains", () => {
  it("aggregates realized gains across multiple securities", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: "aapl", type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
      tx({ securityId: "aapl", type: "SELL", date: "2024-03-01", quantity: 5, price: 150 }),
      tx({ securityId: "asml", type: "BUY", date: "2024-01-01", quantity: 4, price: 500 }),
      tx({ securityId: "asml", type: "SELL", date: "2024-02-01", quantity: 4, price: 400 }),
    ];

    const gains = calculateRealizedGains(transactions);
    expect(gains).toHaveLength(2);

    const aaplGain = gains.find((g) => g.securityId === "aapl");
    expect(aaplGain?.realizedPnL.toString()).toBe("250"); // (150-100)*5

    const asmlGain = gains.find((g) => g.securityId === "asml");
    expect(asmlGain?.realizedPnL.toString()).toBe("-400"); // (400-500)*4

    expect(totalRealizedPnL(gains).toString()).toBe("-150");
  });

  it("returns an empty list when there are no sells", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: "aapl", type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
    ];
    expect(calculateRealizedGains(transactions)).toHaveLength(0);
    expect(totalRealizedPnL([]).toString()).toBe("0");
  });

  it("sorts realized gains chronologically regardless of input/security order", () => {
    resetSequence();
    const transactions = [
      tx({ securityId: "asml", type: "BUY", date: "2024-01-01", quantity: 1, price: 500 }),
      tx({ securityId: "asml", type: "SELL", date: "2024-05-01", quantity: 1, price: 550 }),
      tx({ securityId: "aapl", type: "BUY", date: "2024-01-01", quantity: 1, price: 100 }),
      tx({ securityId: "aapl", type: "SELL", date: "2024-02-01", quantity: 1, price: 110 }),
    ];

    const gains = calculateRealizedGains(transactions);
    expect(gains[0].securityId).toBe("aapl");
    expect(gains[1].securityId).toBe("asml");
  });
});
