import Decimal from "decimal.js";

export interface SmaPoint {
  date: Date;
  /** Null for the leading points where fewer than `period` closes exist
   * yet — no gap-filling or partial-window average, since that would
   * silently understate the true SMA. */
  value: Decimal | null;
}

/**
 * Simple moving average over a close-price series, assumed already
 * sorted ascending by date (same contract as everywhere else prices are
 * consumed in this app — see priceHistorySyncService.ts).
 */
export function calculateSMA(prices: { date: Date; close: Decimal }[], period: number): SmaPoint[] {
  const result: SmaPoint[] = [];
  let windowSum = new Decimal(0);

  for (let i = 0; i < prices.length; i++) {
    windowSum = windowSum.plus(prices[i].close);
    if (i >= period) {
      windowSum = windowSum.minus(prices[i - period].close);
    }
    result.push({
      date: prices[i].date,
      value: i >= period - 1 ? windowSum.dividedBy(period) : null,
    });
  }

  return result;
}

export interface FibonacciLevel {
  /** e.g. "38.2%" */
  label: string;
  ratio: number;
  price: Decimal;
}

/** Standard retracement ratios — 0% at the swing high, 100% at the swing
 * low, matching every charting platform's convention regardless of
 * whether the underlying trend is up or down. */
const FIBONACCI_RATIOS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

export function calculateFibonacciLevels(high: Decimal, low: Decimal): FibonacciLevel[] {
  const range = high.minus(low);
  return FIBONACCI_RATIOS.map((ratio) => ({
    label: `${(ratio * 100).toFixed(1)}%`,
    ratio,
    price: high.minus(range.times(ratio)),
  }));
}
