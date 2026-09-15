import Decimal from "decimal.js";
import { getPortfolioValueHistory } from "./portfolioValueHistoryService";
import { getFinancialDataProvider } from "@/lib/providers/financialData";

export interface BenchmarkComparisonPoint {
  date: string;
  /** Actual reconstructed portfolio value in the base currency. NOT a
   * time-weighted return — a deposit or withdrawal during the period
   * shows up here as apparent gain/loss (see the caveat surfaced
   * alongside this on the Analytics page). */
  portfolioValueBase: number;
  /** Hypothetical value of the *same starting amount* if it had instead
   * been put into the benchmark ticker on the first sample date — i.e.
   * `baseValue * (1 + benchmark's own cumulative price return)`. Lets the
   * two lines share one axis (currency) instead of one being an abstract
   * %. Null before the benchmark's own price history starts. */
  benchmarkValueBase: number | null;
  /** Cumulative growth of total portfolio value since the first sample,
   * as a fraction (0.1 = +10%) — kept alongside the value for a tooltip
   * that wants both. */
  portfolioReturn: number;
  /** Cumulative price return of the benchmark ticker over the same
   * window, or null before the benchmark's own price history starts. */
  benchmarkReturn: number | null;
}

export interface BenchmarkComparison {
  benchmarkTicker: string;
  points: BenchmarkComparisonPoint[];
  /** Set when the benchmark ticker's own price history couldn't be
   * fetched at all — the portfolio line still renders, but the caller
   * should say *why* the benchmark one is missing rather than leaving it
   * unexplained. */
  benchmarkError: string | null;
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

const DAY_MS = 86_400_000;
/** Padding before the actual date range we need, so `nearestOnOrBefore`
 * always has a candidate even when the range's exact start date isn't a
 * trading day (a weekend, a market holiday) — fetching a series that
 * starts exactly *at* `firstDate` would otherwise make it structurally
 * impossible to find anything "on or before" `firstDate` whenever
 * `firstDate` itself didn't trade, which read as "no price history that
 * far back" even for tickers that have traded for decades. */
const LOOKBACK_PADDING_DAYS = 10;

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
  // getPortfolioValueHistory anchors at the first DEPOSIT, which should
  // already be a meaningful positive value — this is just a last-resort
  // guard against the rare case where even that's <= 0 (e.g. fees or a
  // same-day withdrawal wiped it out), so a stray non-positive point
  // can't still blow up the ratios below.
  const baseIndex = fullHistory.findIndex((p) => p.valueBase.greaterThan(0));
  const valueHistory = baseIndex === -1 ? [] : fullHistory.slice(baseIndex);
  if (valueHistory.length < 2) {
    return { benchmarkTicker, points: [], benchmarkError: null };
  }

  const provider = getFinancialDataProvider();
  const firstDate = valueHistory[0].date;
  const lastDate = valueHistory.at(-1)!.date;

  const fetchFrom = new Date(firstDate.getTime() - LOOKBACK_PADDING_DAYS * DAY_MS);

  let benchmarkSeries: PricePoint[] = [];
  let benchmarkError: string | null = null;
  try {
    const historicalPoints = await provider.getHistoricalPrices(benchmarkTicker, fetchFrom, lastDate);
    benchmarkSeries = historicalPoints.map((p) => ({ date: p.date, close: p.close }));
    if (benchmarkSeries.length === 0) {
      benchmarkError = `No price history found for "${benchmarkTicker}" — check the ticker is correct.`;
    }
  } catch (error) {
    // A bad/unresolvable ticker degrades to "no benchmark line" rather than
    // failing the whole comparison — the portfolio's own series is still
    // useful — but the reason is surfaced via `benchmarkError` instead of
    // silently rendering an empty line with no explanation.
    benchmarkSeries = [];
    benchmarkError = error instanceof Error ? error.message : "Failed to load benchmark price history.";
  }

  const baseValue = valueHistory[0].valueBase;
  const baseBenchmarkClose = nearestOnOrBefore(benchmarkSeries, firstDate)?.close ?? null;
  if (!benchmarkError && benchmarkSeries.length > 0 && baseBenchmarkClose === null) {
    benchmarkError = `"${benchmarkTicker}"'s own price history doesn't reach back to ${firstDate.toISOString().slice(0, 10)} yet.`;
  }

  const points: BenchmarkComparisonPoint[] = valueHistory.map((point) => {
    const portfolioReturn = baseValue.isZero()
      ? 0
      : point.valueBase.dividedBy(baseValue).minus(1).toNumber();

    const benchmarkClose = nearestOnOrBefore(benchmarkSeries, point.date)?.close ?? null;
    const benchmarkReturn =
      benchmarkClose && baseBenchmarkClose && !baseBenchmarkClose.isZero()
        ? benchmarkClose.dividedBy(baseBenchmarkClose).minus(1).toNumber()
        : null;
    const benchmarkValueBase =
      benchmarkReturn !== null ? baseValue.times(1 + benchmarkReturn).toNumber() : null;

    return {
      date: point.date.toISOString().slice(0, 10),
      portfolioValueBase: point.valueBase.toNumber(),
      benchmarkValueBase,
      portfolioReturn,
      benchmarkReturn,
    };
  });

  return { benchmarkTicker, points, benchmarkError };
}
