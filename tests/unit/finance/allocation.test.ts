import { describe, expect, it } from "vitest";
import { deriveHoldings, type SecurityMeta } from "@/lib/finance/holdings";
import { calculateAllocation } from "@/lib/finance/allocation";
import { d, resetSequence, tx } from "./helpers";

const aapl: SecurityMeta = {
  id: "aapl",
  ticker: "AAPL",
  name: "Apple Inc.",
  assetType: "STOCK",
  sector: "Technology",
  country: "US",
  currency: "EUR",
};
const bond: SecurityMeta = {
  id: "bond1",
  ticker: "GOVT",
  name: "Government Bond ETF",
  assetType: "BOND",
  sector: null,
  country: "US",
  currency: "EUR",
};

function buildHoldings() {
  resetSequence();
  const transactions = [
    tx({ securityId: aapl.id, type: "BUY", date: "2024-01-01", quantity: 10, price: 100 }),
    tx({ securityId: bond.id, type: "BUY", date: "2024-01-01", quantity: 10, price: 300 }),
  ];
  const now = new Date();
  return deriveHoldings(
    transactions,
    [aapl, bond],
    new Map([
      [aapl.id, { securityId: aapl.id, price: d(100), currency: "EUR", asOf: now }],
      [bond.id, { securityId: bond.id, price: d(300), currency: "EUR", asOf: now }],
    ]),
    [],
    "EUR"
  );
}

describe("calculateAllocation", () => {
  it("computes weight by asset type summing to 1", () => {
    const holdings = buildHoldings();
    const buckets = calculateAllocation(holdings, "assetType");

    // AAPL: 1000, bond: 3000, total 4000 -> weights 0.25 / 0.75
    const stock = buckets.find((b) => b.key === "STOCK");
    const bondBucket = buckets.find((b) => b.key === "BOND");
    expect(stock?.weight.toString()).toBe("0.25");
    expect(bondBucket?.weight.toString()).toBe("0.75");
  });

  it("groups an unknown sector into an explicit UNKNOWN bucket rather than dropping it", () => {
    const holdings = buildHoldings();
    const buckets = calculateAllocation(holdings, "sector");
    const unknown = buckets.find((b) => b.key === "UNKNOWN");
    expect(unknown).toBeDefined();
    expect(unknown?.label).toBe("Unknown");
  });

  it("returns an empty list for an empty portfolio", () => {
    expect(calculateAllocation([], "assetType")).toHaveLength(0);
  });

  it("sorts buckets by value descending", () => {
    const holdings = buildHoldings();
    const buckets = calculateAllocation(holdings, "security");
    expect(buckets[0].key).toBe(bond.id);
    expect(buckets[1].key).toBe(aapl.id);
  });
});
