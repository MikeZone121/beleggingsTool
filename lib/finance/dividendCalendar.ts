import Decimal from "decimal.js";

export interface DividendHistoryPoint {
  exDividendDate: Date;
  dividendPerShare: Decimal;
}

export interface EstimatedDividend {
  lastExDate: Date;
  lastAmountPerShare: Decimal;
  estimatedNextExDate: Date;
  estimatedAmountPerShare: Decimal;
  estimatedIntervalDays: number;
  paymentsOnRecord: number;
}

const DAY_MS = 86_400_000;
/** Fallback cadence (quarterly) when there's too little history to infer
 * one — most dividend payers on a regular schedule pay quarterly. */
const DEFAULT_INTERVAL_DAYS = 91;

/**
 * Belgian "roerende voorheffing" — the flat withholding tax on dividend
 * (and other movable) income, applied by the paying broker before payout.
 * This is a simplification for an *estimate*: it ignores the annual
 * tax-free allowance on dividend income (claimed back via the tax return,
 * not withheld at source) and any foreign withholding tax already deducted
 * abroad (e.g. the US's 15% under the tax treaty) — both would reduce the
 * effective Belgian tax below this flat rate for at least some of a real
 * dividend. Treat this net figure as a lower-bound estimate, not a filing.
 */
export const BELGIAN_DIVIDEND_WITHHOLDING_TAX_RATE = new Decimal("0.30");

export interface EstimatedDividendPayout {
  /** Total gross estimated payout in the portfolio's base currency — null
   * when there's no FX rate to convert the security's own currency. */
  grossBase: Decimal | null;
  taxBase: Decimal | null;
  netBase: Decimal | null;
}

/** Applies the flat Belgian withholding rate to a gross amount already
 * converted to the base currency — kept separate from the FX conversion
 * itself (done by the caller, which has the FX rate table) so this stays a
 * pure, easily-testable function. */
export function estimateBelgianDividendPayout(grossBase: Decimal | null): EstimatedDividendPayout {
  if (grossBase === null) {
    return { grossBase: null, taxBase: null, netBase: null };
  }
  const taxBase = grossBase.times(BELGIAN_DIVIDEND_WITHHOLDING_TAX_RATE);
  return { grossBase, taxBase, netBase: grossBase.minus(taxBase) };
}

/**
 * Projects the next ex-dividend date/amount for a security from its paid
 * history — there is no confirmed "next" date here (see
 * `dividendSyncService.ts`), only a projection from the recent cadence, so
 * callers must present this as an estimate, never as a fact.
 *
 * Uses the *median* of the last few gaps (not the mean) so one irregular
 * gap — a special dividend, a delayed payment, a temporarily suspended
 * payout — doesn't skew the projected interval as much as an outlier would.
 */
export function estimateNextDividend(
  history: DividendHistoryPoint[]
): EstimatedDividend | null {
  if (history.length === 0) return null;

  const sorted = [...history].sort(
    (a, b) => a.exDividendDate.getTime() - b.exDividendDate.getTime()
  );
  const last = sorted.at(-1)!;

  const recentGaps: number[] = [];
  for (let i = Math.max(1, sorted.length - 4); i < sorted.length; i++) {
    const days = (sorted[i].exDividendDate.getTime() - sorted[i - 1].exDividendDate.getTime()) / DAY_MS;
    recentGaps.push(days);
  }
  recentGaps.sort((a, b) => a - b);
  const intervalDays =
    recentGaps.length > 0 ? recentGaps[Math.floor(recentGaps.length / 2)] : DEFAULT_INTERVAL_DAYS;

  const recentAmounts = sorted.slice(-4).map((d) => d.dividendPerShare);
  const estimatedAmountPerShare = recentAmounts
    .reduce((sum, amount) => sum.plus(amount), new Decimal(0))
    .dividedBy(recentAmounts.length);

  return {
    lastExDate: last.exDividendDate,
    lastAmountPerShare: last.dividendPerShare,
    estimatedNextExDate: new Date(last.exDividendDate.getTime() + intervalDays * DAY_MS),
    estimatedAmountPerShare,
    estimatedIntervalDays: Math.round(intervalDays),
    paymentsOnRecord: sorted.length,
  };
}
