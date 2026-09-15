import Decimal from "decimal.js";
import { ZERO } from "./money";

const DAY_MS = 86_400_000;

export interface VolatilityMetrics {
  /** Annualized. Assumes a 0% risk-free rate — this app has no bond-yield
   * data source, and a hardcoded rate would just go stale silently, so
   * plain return/volatility is the honest simplification (common for
   * retail trackers; UI copy should say so). */
  sharpeRatio: Decimal | null;
  /** Same 0%-risk-free simplification as Sharpe, but only penalizes
   * downside volatility (returns below 0) rather than all volatility. */
  sortinoRatio: Decimal | null;
  /** Samples/year implied by the value history's actual spacing —
   * surfaced so the UI can disclose the annualization basis instead of
   * presenting a bare "assumes weekly sampling" number silently. */
  periodsPerYear: Decimal | null;
}

function mean(values: Decimal[]): Decimal {
  if (values.length === 0) return ZERO;
  return values.reduce((acc, v) => acc.plus(v), ZERO).dividedBy(values.length);
}

/** Sample standard deviation (n-1) — these returns are a sample of the
 * portfolio's behavior, not the full population of it. */
function stdev(values: Decimal[]): Decimal | null {
  if (values.length < 2) return null;
  const m = mean(values);
  const variance = values
    .reduce((acc, v) => acc.plus(v.minus(m).pow(2)), ZERO)
    .dividedBy(values.length - 1);
  return variance.sqrt();
}

function downsideDeviation(returns: Decimal[], minimumAcceptableReturn: Decimal): Decimal | null {
  const shortfalls = returns
    .filter((r) => r.lessThan(minimumAcceptableReturn))
    .map((r) => r.minus(minimumAcceptableReturn));
  if (shortfalls.length === 0) return null;
  const sumSquares = shortfalls.reduce((acc, v) => acc.plus(v.pow(2)), ZERO);
  return sumSquares.dividedBy(returns.length).sqrt();
}

/** Simple period-over-period returns from a value series — the building
 * block for both Sharpe/Sortino (variance of these) and Beta (covariance
 * of these against a benchmark's own period returns). */
export function calculatePeriodReturns(values: Decimal[]): Decimal[] {
  const returns: Decimal[] = [];
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1].isZero()) continue;
    returns.push(values[i].dividedBy(values[i - 1]).minus(1));
  }
  return returns;
}

function estimatePeriodsPerYear(dates: Date[]): Decimal | null {
  if (dates.length < 2) return null;
  const totalDays = (dates[dates.length - 1].getTime() - dates[0].getTime()) / DAY_MS;
  if (totalDays <= 0) return null;
  const avgGapDays = totalDays / (dates.length - 1);
  if (avgGapDays <= 0) return null;
  return new Decimal(365.25).dividedBy(avgGapDays);
}

/**
 * Sharpe and Sortino ratios from a reconstructed portfolio value history
 * (see portfolioValueHistoryService.ts) — needs at least 3 sample points
 * (2 period returns) to produce a variance at all.
 */
export function calculateVolatilityMetrics(
  valueHistory: { date: Date; valueBase: Decimal }[]
): VolatilityMetrics {
  const dates = valueHistory.map((p) => p.date);
  const periodsPerYear = estimatePeriodsPerYear(dates);
  const returns = calculatePeriodReturns(valueHistory.map((p) => p.valueBase));

  if (returns.length < 2 || !periodsPerYear) {
    return { sharpeRatio: null, sortinoRatio: null, periodsPerYear };
  }

  const meanReturn = mean(returns);
  const annualizationFactor = periodsPerYear.sqrt();

  const volatility = stdev(returns);
  const sharpeRatio =
    volatility && !volatility.isZero()
      ? meanReturn.dividedBy(volatility).times(annualizationFactor)
      : null;

  const downside = downsideDeviation(returns, ZERO);
  const sortinoRatio =
    downside && !downside.isZero() ? meanReturn.dividedBy(downside).times(annualizationFactor) : null;

  return { sharpeRatio, sortinoRatio, periodsPerYear };
}

/**
 * Beta vs. a benchmark — covariance of the portfolio's period returns
 * with the benchmark's, divided by the benchmark's own variance. Takes
 * the same cumulative-return pairs the benchmark chart already computes
 * (see benchmarkService.ts) rather than refetching anything; a benchmark
 * return of null (before its own price history starts) breaks the pair
 * chain until both sides resume, so a leading gap doesn't get counted as
 * one giant first-period return.
 */
export function calculateBeta(
  points: { portfolioReturn: number; benchmarkReturn: number | null }[]
): Decimal | null {
  const portfolioReturns: Decimal[] = [];
  const benchmarkReturns: Decimal[] = [];

  let prevPortfolioCum: Decimal | null = null;
  let prevBenchmarkCum: Decimal | null = null;

  for (const point of points) {
    const portfolioCum = new Decimal(1).plus(point.portfolioReturn);
    const benchmarkCum = point.benchmarkReturn === null ? null : new Decimal(1).plus(point.benchmarkReturn);

    if (benchmarkCum && prevPortfolioCum && prevBenchmarkCum) {
      portfolioReturns.push(portfolioCum.dividedBy(prevPortfolioCum).minus(1));
      benchmarkReturns.push(benchmarkCum.dividedBy(prevBenchmarkCum).minus(1));
    }

    prevPortfolioCum = portfolioCum;
    if (benchmarkCum) prevBenchmarkCum = benchmarkCum;
  }

  if (portfolioReturns.length < 2) return null;

  const portfolioMean = mean(portfolioReturns);
  const benchmarkMean = mean(benchmarkReturns);

  const covariance = portfolioReturns
    .reduce(
      (acc, p, i) => acc.plus(p.minus(portfolioMean).times(benchmarkReturns[i].minus(benchmarkMean))),
      ZERO
    )
    .dividedBy(portfolioReturns.length - 1);

  const benchmarkVariance = benchmarkReturns
    .reduce((acc, b) => acc.plus(b.minus(benchmarkMean).pow(2)), ZERO)
    .dividedBy(benchmarkReturns.length - 1);

  if (benchmarkVariance.isZero()) return null;
  return covariance.dividedBy(benchmarkVariance);
}
