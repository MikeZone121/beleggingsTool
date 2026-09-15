import Decimal from "decimal.js";
import { listAllocationTargets } from "@/lib/db/allocationTargets";
import { calculateAllocation } from "@/lib/finance/allocation";
import { calculateRebalancing, totalTargetWeight, type RebalancingRow } from "@/lib/finance/rebalancing";
import { getPortfolioSnapshot } from "./holdingsService";
import type { AllocationDimension } from "@/types/domain";

export interface RebalancingPlanRow extends RebalancingRow {
  /** The underlying `AllocationTarget` row's id, so the UI can delete it —
   * null when this bucket has no target set yet. */
  targetId: string | null;
}

export interface RebalancingPlan {
  dimension: AllocationDimension;
  baseCurrency: string;
  totalValue: Decimal;
  /** Sum of every target set for this dimension — should read close to
   * 100% (1) for the suggested trades to make sense together. */
  totalTargetWeight: Decimal;
  rows: RebalancingPlanRow[];
}

/**
 * Same holdings-only weighting `calculateAllocation` already uses on the
 * Dashboard (no cash in the denominator) — targets are set against that
 * same baseline, not a mix of two different totals.
 */
export async function getRebalancingPlan(
  userId: string,
  portfolioId: string,
  dimension: AllocationDimension
): Promise<RebalancingPlan> {
  const snapshot = await getPortfolioSnapshot(userId, portfolioId);
  const buckets = calculateAllocation(snapshot.holdings, dimension);
  const totalValue = buckets.reduce((sum, b) => sum.plus(b.valueBase), new Decimal(0));

  const targetRows = await listAllocationTargets(portfolioId, dimension);
  const targets = new Map(targetRows.map((t) => [t.key, new Decimal(t.targetPercent)]));
  const targetIdByKey = new Map(targetRows.map((t) => [t.key, t.id]));

  const rows = calculateRebalancing(buckets, targets, totalValue).map((row) => ({
    ...row,
    targetId: targetIdByKey.get(row.key) ?? null,
  }));

  return {
    dimension,
    baseCurrency: snapshot.baseCurrency,
    totalValue,
    totalTargetWeight: totalTargetWeight(targets),
    rows,
  };
}
