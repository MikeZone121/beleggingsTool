import Decimal from "decimal.js";
import type { Holding } from "@/types/domain";
import { ZERO } from "./money";

export interface HoldingsInsights {
  best: Holding | null;
  worst: Holding | null;
  /** Fraction of total holdings value held in the largest `topN`
   * positions (0.6 = 60%) — a simple concentration-risk read: "a third of
   * your money moves with one stock" is more concrete than a % list. */
  topConcentration: Decimal;
  topN: number;
}

/**
 * Best/worst holding by unrealized return %, and how concentrated the
 * portfolio is in its largest few positions — both derived from the same
 * live `Holding[]` the Dashboard/Portfolio pages already compute, no new
 * data source needed.
 */
export function calculateHoldingsInsights(holdings: Holding[], topN = 3): HoldingsInsights {
  const withReturn = holdings.filter((h) => h.unrealizedPnLPercent !== null);
  const sorted = [...withReturn].sort((a, b) =>
    a.unrealizedPnLPercent!.comparedTo(b.unrealizedPnLPercent!)
  );
  const worst = sorted[0] ?? null;
  const best = sorted.length > 0 ? sorted[sorted.length - 1] : null;

  const totalValue = holdings.reduce((sum, h) => sum.plus(h.marketValueBase ?? ZERO), ZERO);
  const byValueDesc = [...holdings].sort((a, b) =>
    (b.marketValueBase ?? ZERO).comparedTo(a.marketValueBase ?? ZERO)
  );
  const topValue = byValueDesc
    .slice(0, topN)
    .reduce((sum, h) => sum.plus(h.marketValueBase ?? ZERO), ZERO);
  const topConcentration = totalValue.isZero() ? ZERO : topValue.dividedBy(totalValue);

  return { best, worst, topConcentration, topN };
}
