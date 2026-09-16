import Decimal from "decimal.js";

export interface ClosePricePoint {
  date: Date;
  close: Decimal;
}

/** Below this many overlapping trading days, a correlation coefficient is
 * more noise than signal — two securities that only have e.g. 3 common
 * price dates can produce a misleadingly extreme number. */
const MIN_OVERLAPPING_DAYS = 10;

function dailyReturnsByDate(prices: ClosePricePoint[]): Map<string, Decimal> {
  const sorted = [...prices].sort((a, b) => a.date.getTime() - b.date.getTime());
  const returns = new Map<string, Decimal>();
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].close.isZero()) continue;
    const dateKey = sorted[i].date.toISOString().slice(0, 10);
    returns.set(dateKey, sorted[i].close.dividedBy(sorted[i - 1].close).minus(1));
  }
  return returns;
}

/**
 * Pearson correlation of two securities' daily returns, restricted to
 * dates both actually have a cached close for — two securities on
 * different exchanges (different holiday calendars) rarely have
 * identical trading days, so aligning on the intersection rather than
 * assuming matching indices avoids silently pairing up the wrong days.
 * Returns null when there isn't enough overlap to mean anything.
 */
export function calculatePearsonCorrelation(
  pricesA: ClosePricePoint[],
  pricesB: ClosePricePoint[]
): Decimal | null {
  const returnsA = dailyReturnsByDate(pricesA);
  const returnsB = dailyReturnsByDate(pricesB);

  const commonDates = Array.from(returnsA.keys()).filter((d) => returnsB.has(d));
  if (commonDates.length < MIN_OVERLAPPING_DAYS) return null;

  const xs = commonDates.map((d) => returnsA.get(d)!);
  const ys = commonDates.map((d) => returnsB.get(d)!);

  const zero = new Decimal(0);
  const meanX = xs.reduce((acc, v) => acc.plus(v), zero).dividedBy(xs.length);
  const meanY = ys.reduce((acc, v) => acc.plus(v), zero).dividedBy(ys.length);

  let covariance = zero;
  let varianceX = zero;
  let varianceY = zero;
  for (let i = 0; i < xs.length; i++) {
    const dx = xs[i].minus(meanX);
    const dy = ys[i].minus(meanY);
    covariance = covariance.plus(dx.times(dy));
    varianceX = varianceX.plus(dx.pow(2));
    varianceY = varianceY.plus(dy.pow(2));
  }

  if (varianceX.isZero() || varianceY.isZero()) return null;
  return covariance.dividedBy(varianceX.times(varianceY).sqrt());
}
