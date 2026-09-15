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
