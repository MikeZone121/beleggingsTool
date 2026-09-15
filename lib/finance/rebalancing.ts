import Decimal from "decimal.js";
import type { AllocationBucket } from "@/types/domain";
import { ZERO } from "./money";

export interface RebalancingRow {
  key: string;
  label: string;
  currentWeight: Decimal;
  currentValueBase: Decimal;
  /** Null when no target is set for this bucket yet. */
  targetWeight: Decimal | null;
  /** `targetWeight - currentWeight`; positive means underweight (room to
   * buy), negative means overweight (room to sell). Null without a target. */
  driftWeight: Decimal | null;
  /** `driftWeight * totalValue` — a positive amount to buy, a negative
   * amount to sell, to reach the target exactly. Null without a target. */
  suggestedTradeBase: Decimal | null;
}

/**
 * Compares each allocation bucket's current weight (from `calculateAllocation`)
 * against a user-set target, and translates the gap into a concrete
 * buy/sell amount in the base currency — turning "you're at 45% stock,
 * target is 60%" into "buy about €3,200 of stock".
 *
 * A bucket that currently exists but has no target (or a target key with no
 * matching bucket, e.g. a target set before ever buying that asset type) is
 * still included — drift/suggestion are simply null rather than dropping
 * the row, so the caller can show "no target set" instead of silently
 * hiding a real holding.
 */
export function calculateRebalancing(
  buckets: AllocationBucket[],
  targets: Map<string, Decimal>,
  totalValue: Decimal
): RebalancingRow[] {
  const keys = new Set<string>([...buckets.map((b) => b.key), ...targets.keys()]);

  const rows = Array.from(keys).map((key) => {
    const bucket = buckets.find((b) => b.key === key);
    const targetWeight = targets.get(key) ?? null;
    const currentWeight = bucket?.weight ?? ZERO;
    const driftWeight = targetWeight !== null ? targetWeight.minus(currentWeight) : null;

    return {
      key,
      label: bucket?.label ?? key,
      currentWeight,
      currentValueBase: bucket?.valueBase ?? ZERO,
      targetWeight,
      driftWeight,
      suggestedTradeBase: driftWeight !== null ? driftWeight.times(totalValue) : null,
    };
  });

  return rows.sort((a, b) => b.currentValueBase.comparedTo(a.currentValueBase));
}

/** Sum of all set targets for a dimension — surfaced so the UI can warn
 * when targets don't add up to 100%, rather than silently accepting an
 * inconsistent set. */
export function totalTargetWeight(targets: Map<string, Decimal>): Decimal {
  return Array.from(targets.values()).reduce((sum, t) => sum.plus(t), ZERO);
}
