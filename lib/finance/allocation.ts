import type { AllocationBucket, AllocationDimension, Holding } from "@/types/domain";
import { calculatePortfolioValue } from "./portfolioValue";
import { ratioOf, sum, ZERO } from "./money";

function bucketKey(holding: Holding, dimension: AllocationDimension): {
  key: string;
  label: string;
} {
  switch (dimension) {
    case "security":
      return { key: holding.securityId, label: holding.ticker };
    case "assetType":
      return { key: holding.assetType, label: holding.assetType };
    case "sector":
      return { key: holding.sector ?? "UNKNOWN", label: holding.sector ?? "Unknown" };
    case "country":
      return { key: holding.country ?? "UNKNOWN", label: holding.country ?? "Unknown" };
    case "currency":
      return { key: holding.currency, label: holding.currency };
  }
}

/**
 * Groups holdings by the requested dimension and computes each bucket's
 * weight as a fraction of total portfolio value (holdings only, cash
 * excluded from the denominator unless passed in `cashBalancesBase`).
 *
 * Holdings with `missingFx: true` contribute 0 to their bucket's value
 * (consistent with `calculatePortfolioValue`) rather than being dropped,
 * so weights still sum to <= 1 even with incomplete FX data.
 */
export function calculateAllocation(
  holdings: Holding[],
  dimension: AllocationDimension,
  cashBalancesBase: Parameters<typeof calculatePortfolioValue>[1] = []
): AllocationBucket[] {
  const totalValue = calculatePortfolioValue(holdings, cashBalancesBase);

  const buckets = new Map<string, AllocationBucket>();
  for (const holding of holdings) {
    const { key, label } = bucketKey(holding, dimension);
    const value = holding.marketValueBase ?? ZERO;
    const existing = buckets.get(key);
    if (existing) {
      existing.valueBase = existing.valueBase.plus(value);
    } else {
      buckets.set(key, { key, label, valueBase: value, weight: ZERO });
    }
  }

  const result = Array.from(buckets.values());
  for (const bucket of result) {
    bucket.weight = ratioOf(bucket.valueBase, totalValue) ?? ZERO;
  }

  return result.sort((a, b) => b.valueBase.comparedTo(a.valueBase));
}

export function allocationTotal(buckets: AllocationBucket[]) {
  return sum(buckets.map((b) => b.valueBase));
}
