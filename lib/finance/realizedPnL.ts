import Decimal from "decimal.js";
import type { DomainTransaction, SplitEvent, RealizedGain } from "@/types/domain";
import {
  computeAverageCostLedger,
  type FiscalStepUp,
  type FxContext,
} from "./costBasis";
import { ZERO } from "./money";

/**
 * Realized gains/losses for every security touched by `transactions`, using
 * the same average-cost ledger as `deriveHoldings` (so realized and
 * unrealized P&L are always consistent with one another). Pass `fxContext`
 * to also get each gain's base-currency equivalents (see costBasis.ts for
 * why base-currency cost basis uses historical, per-transaction rates).
 *
 * `stepUpBySecurity` re-bases each security's cost basis on a given date
 * instead of using what was actually paid — only for the Belgian
 * capital-gains regime's 31/12/2025 reference value, never for reported
 * accounting P&L (see lib/finance/capitalGainsTax.ts).
 */
export function calculateRealizedGains(
  transactions: DomainTransaction[],
  splitsBySecurity: Map<string, SplitEvent[]> = new Map(),
  fxContext?: FxContext,
  stepUpBySecurity: Map<string, FiscalStepUp> = new Map()
): RealizedGain[] {
  const bySecurity = new Map<string, DomainTransaction[]>();
  for (const tx of transactions) {
    if (tx.securityId === null) continue;
    const list = bySecurity.get(tx.securityId) ?? [];
    list.push(tx);
    bySecurity.set(tx.securityId, list);
  }

  const gains: RealizedGain[] = [];
  for (const [securityId, txs] of bySecurity) {
    const ledger = computeAverageCostLedger(
      securityId,
      txs,
      splitsBySecurity.get(securityId) ?? [],
      fxContext,
      stepUpBySecurity.get(securityId)
    );
    gains.push(...ledger.realizedGains);
  }

  return gains.sort((a, b) => a.date.getTime() - b.date.getTime());
}

/** Sum of `realizedPnL` in each gain's own security currency — only
 * meaningful when every gain shares one currency; for a portfolio-wide
 * total across currencies use `totalRealizedPnLBase`. */
export function totalRealizedPnL(gains: RealizedGain[]): Decimal {
  return gains.reduce((acc, g) => acc.plus(g.realizedPnL), ZERO);
}

/** Portfolio-wide realized P&L in the base currency. `hasMissingFx` is true
 * when at least one gain's base-currency amount couldn't be resolved (its
 * `realizedPnLBase` was null) — `total` still sums whatever is available
 * rather than being reduced to null itself, but callers should surface
 * `hasMissingFx` so an incomplete total is never presented as final. */
export function totalRealizedPnLBase(gains: RealizedGain[]): {
  total: Decimal;
  hasMissingFx: boolean;
} {
  let total = ZERO;
  let hasMissingFx = false;
  for (const g of gains) {
    if (g.realizedPnLBase === null) {
      hasMissingFx = true;
      continue;
    }
    total = total.plus(g.realizedPnLBase);
  }
  return { total, hasMissingFx };
}
