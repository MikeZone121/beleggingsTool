import Decimal from "decimal.js";
import type { DomainTransaction } from "@/types/domain";
import type { FxContext } from "./costBasis";
import { convertToBase } from "./currency";
import { ZERO } from "./money";

export interface YearlyCosts {
  year: number;
  feesBase: Decimal;
  taxesBase: Decimal;
}

export interface CostsSummary {
  /** Every transaction's `fees` + `taxes`, converted to the base currency
   * via that transaction's own historical FX rate (never today's — same
   * rule as cost basis and dividend income elsewhere in this app). This
   * is broker commissions and whatever `taxes` was recorded as on each
   * transaction (e.g. a manually-entered Belgian beurstaks) — not a
   * separate synthetic tax estimate. */
  totalFeesBase: Decimal;
  totalTaxesBase: Decimal;
  byYear: YearlyCosts[];
  /** True if any transaction's fees/taxes couldn't be converted (missing
   * FX rate) — the totals still sum whatever is available rather than
   * treating the gap as zero. */
  hasMissingFx: boolean;
}

export function calculateCostsSummary(
  transactions: DomainTransaction[],
  fxContext: FxContext
): CostsSummary {
  let totalFeesBase = ZERO;
  let totalTaxesBase = ZERO;
  let hasMissingFx = false;
  const byYearMap = new Map<number, { feesBase: Decimal; taxesBase: Decimal }>();

  for (const tx of transactions) {
    if (tx.fees.isZero() && tx.taxes.isZero()) continue;

    const feesBase = tx.fees.isZero()
      ? ZERO
      : convertToBase(tx.fees, tx.currency, fxContext.baseCurrency, tx.date, fxContext.fxRates);
    const taxesBase = tx.taxes.isZero()
      ? ZERO
      : convertToBase(tx.taxes, tx.currency, fxContext.baseCurrency, tx.date, fxContext.fxRates);

    if (feesBase === null || taxesBase === null) {
      hasMissingFx = true;
      continue;
    }

    totalFeesBase = totalFeesBase.plus(feesBase);
    totalTaxesBase = totalTaxesBase.plus(taxesBase);

    const year = tx.date.getFullYear();
    const existing = byYearMap.get(year) ?? { feesBase: ZERO, taxesBase: ZERO };
    byYearMap.set(year, {
      feesBase: existing.feesBase.plus(feesBase),
      taxesBase: existing.taxesBase.plus(taxesBase),
    });
  }

  const byYear = Array.from(byYearMap.entries())
    .map(([year, v]) => ({ year, ...v }))
    .sort((a, b) => a.year - b.year);

  return { totalFeesBase, totalTaxesBase, byYear, hasMissingFx };
}
