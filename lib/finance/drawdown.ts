import Decimal from "decimal.js";
import { ZERO } from "./money";

export interface DrawdownPoint {
  date: Date;
  /** Fraction below the running peak so far (0 at a new high, -0.15 =
   * 15% below the highest value seen up to this point). Never positive. */
  drawdown: Decimal;
}

export interface DrawdownResult {
  /** The single worst drawdown fraction across the whole series (0 if the
   * portfolio has only ever climbed, or there's fewer than 2 points). */
  maxDrawdown: Decimal;
  maxDrawdownDate: Date | null;
  series: DrawdownPoint[];
}

/**
 * Peak-to-trough decline at each point in a value history — the standard
 * "how much could you have lost if you'd bought at the worst possible
 * moment and sold at the next-worst" risk measure. Reuses whatever value
 * series the caller already reconstructed (see
 * `portfolioValueHistoryService.ts`) rather than needing its own data.
 */
export function calculateDrawdown(points: { date: Date; valueBase: Decimal }[]): DrawdownResult {
  if (points.length === 0) {
    return { maxDrawdown: ZERO, maxDrawdownDate: null, series: [] };
  }

  let peak = points[0].valueBase;
  let maxDrawdown = ZERO;
  let maxDrawdownDate: Date | null = null;
  const series: DrawdownPoint[] = [];

  for (const point of points) {
    if (point.valueBase.greaterThan(peak)) peak = point.valueBase;
    const drawdown = peak.isZero() ? ZERO : point.valueBase.dividedBy(peak).minus(1);
    series.push({ date: point.date, drawdown });
    if (drawdown.lessThan(maxDrawdown)) {
      maxDrawdown = drawdown;
      maxDrawdownDate = point.date;
    }
  }

  return { maxDrawdown, maxDrawdownDate, series };
}
