import Decimal from "decimal.js";
import type { Holding } from "@/types/domain";
import { ZERO } from "./money";

/**
 * Total portfolio value = sum of holdings' market value (in the portfolio's
 * base currency) + cash balances (already converted to base currency).
 *
 * A holding with `missingFx: true` contributes `0` here rather than being
 * silently excluded from the sum — callers should surface `missingFx`/
 * `priceStale` holdings distinctly so the KPI is never presented as more
 * complete than it is.
 */
export function calculatePortfolioValue(
  holdings: Holding[],
  cashBalancesBase: Decimal[] = []
): Decimal {
  const holdingsValue = holdings.reduce(
    (acc, h) => acc.plus(h.marketValueBase ?? ZERO),
    ZERO
  );
  const cash = cashBalancesBase.reduce((acc, v) => acc.plus(v), ZERO);
  return holdingsValue.plus(cash);
}

export function calculateTotalCostBasis(holdings: Holding[]): Decimal {
  return holdings.reduce((acc, h) => acc.plus(h.costBasisBase ?? ZERO), ZERO);
}

export function calculateTotalUnrealizedPnL(holdings: Holding[]): Decimal {
  return holdings.reduce((acc, h) => acc.plus(h.unrealizedPnLBase ?? ZERO), ZERO);
}
