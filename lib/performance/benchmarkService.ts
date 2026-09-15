import Decimal from "decimal.js";
import { getPortfolioValueHistory } from "./portfolioValueHistoryService";
import { getFinancialDataProvider } from "@/lib/providers/financialData";

export interface BenchmarkComparisonPoint {
  date: string;
  /** Cumulative growth of total portfolio value since the first sample,
   * as a fraction (0.1 = +10%). NOT a time-weighted return — a deposit or
   * withdrawal during the period shows up here as apparent gain/loss (see
   * the caveat surfaced alongside this on the Analytics page). */
  portfolioReturn: number;
  /** Cumulative price return of the benchmark ticker over the same
   * window, or null before the benchmark's own price history starts. */
  benchmarkReturn: number | null;
}

export interface BenchmarkComparison {
  benchmarkTicker: string;
  points: BenchmarkComparisonPoint[];
}

interface PricePoint {
  date: Date;
  close: Decimal;
}

function nearestOnOrBefore(series: PricePoint[], target: Date): PricePoint | null {
  let result: PricePoint | null = null;
  for (const point of series) {
    if (point.date.getTime() > target.getTime()) break;
    result = point;
  }
  return result;
}

/**
 * Pairs the portfolio's reconstructed value history with a benchmark
 * ticker's price history (fetched live — a single security's full range is
 * one provider call, cheap enough not to need its own DB cache), both
 * normalized to "cumulative return since the first sample" so they're
 * comparable on one chart regardless of price scale or currency.
 */
export async function getBenchmarkComparison(
  userId: string,
  portfolioId: string,
  benchmarkTicker: string
): Promise<BenchmarkComparison> {
  const fullHistory = await getPortfolioValueHistory(userId, portfolioId);
  // A near-zero or negative value near the very start (e.g. a security
  // bought before any funding deposit was recorded) would make every
  // later ratio explode — anchor "since the first sample" at the first
  // point that's actually a meaningful base, not an artifact of early,
  // incomplete history.
  const baseIndex = fullHistory.findIndex((p) => p.valueBase.greaterThan(0));
  const valueHistory = baseIndex === -1 ? [] : fullHistory.slice(baseIndex);
  if (valueHistory.length < 2) {
    return { benchmarkTicker, points: [] };
  }

  const provider = getFinancialDataProvider();
  const firstDate = valueHistory[0].date;
  const lastDate = valueHistory.at(-1)!.date;

  let benchmarkSeries: PricePoint[] = [];
  try {
    const historicalPoints = await provider.getHistoricalPrices(benchmarkTicker, firstDate, lastDate);
    benchmarkSeries = historicalPoints.map((p) => ({ date: p.date, close: p.close }));
  } catch {
    // A bad/unresolvable ticker degrades to "no benchmark line" rather than
    // failing the whole comparison — the portfolio's own series is still useful.
    benchmarkSeries = [];
  }

  const baseValue = valueHistory[0].valueBase;
  const baseBenchmarkClose = nearestOnOrBefore(benchmarkSeries, firstDate)?.close ?? null;

  const points: BenchmarkComparisonPoint[] = valueHistory.map((point) => {
    const portfolioReturn = baseValue.isZero()
      ? 0
      : point.valueBase.dividedBy(baseValue).minus(1).toNumber();

    const benchmarkClose = nearestOnOrBefore(benchmarkSeries, point.date)?.close ?? null;
    const benchmarkReturn =
      benchmarkClose && baseBenchmarkClose && !baseBenchmarkClose.isZero()
        ? benchmarkClose.dividedBy(baseBenchmarkClose).minus(1).toNumber()
        : null;

    return {
      date: point.date.toISOString().slice(0, 10),
      portfolioReturn,
      benchmarkReturn,
    };
  });

  return { benchmarkTicker, points };
}
