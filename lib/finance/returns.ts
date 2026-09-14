import Decimal from "decimal.js";
import type { ExternalCashflow } from "@/types/domain";

/**
 * Money-weighted return (XIRR) and simple total return.
 *
 * XIRR methodology: solves for the annualized rate `r` such that
 * `sum(amount_i / (1+r)^(days_i/365)) = 0`, where `days_i` is the number of
 * days between `date_i` and the first cash flow's date. This is the same
 * definition as Excel's XIRR function, including its sign convention (see
 * `ExternalCashflow` in types/domain.ts: negative = invested, positive =
 * returned, including the terminal portfolio value as a final inflow).
 *
 * Solved via Newton-Raphson with a bisection fallback for robustness — the
 * root-finding itself uses plain `number` arithmetic (not Decimal): this is
 * an intentional, narrow exception to the "no floats for money" rule, because
 * XIRR is an iterative numerical approximation of a rate, not a ledger
 * amount — the cash flow amounts themselves stay Decimal all the way in.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_NEWTON_ITERATIONS = 100;
const NEWTON_TOLERANCE = 1e-7;
const MAX_BISECTION_ITERATIONS = 200;
const BISECTION_TOLERANCE = 1e-7;

interface TimedFlow {
  years: number;
  amount: number;
}

function toTimedFlows(cashflows: ExternalCashflow[]): TimedFlow[] {
  const sorted = cashflows.slice().sort((a, b) => a.date.getTime() - b.date.getTime());
  const t0 = sorted[0].date.getTime();
  return sorted.map((cf) => ({
    years: (cf.date.getTime() - t0) / (DAY_MS * 365),
    amount: cf.amount.toNumber(),
  }));
}

function npv(flows: TimedFlow[], rate: number): number {
  return flows.reduce((acc, f) => acc + f.amount / Math.pow(1 + rate, f.years), 0);
}

function npvDerivative(flows: TimedFlow[], rate: number): number {
  return flows.reduce(
    (acc, f) => acc - (f.years * f.amount) / Math.pow(1 + rate, f.years + 1),
    0
  );
}

function hasSignChange(cashflows: ExternalCashflow[]): boolean {
  const hasNegative = cashflows.some((cf) => cf.amount.isNegative());
  const hasPositive = cashflows.some((cf) => cf.amount.isPositive());
  return hasNegative && hasPositive;
}

function bisectionSolve(flows: TimedFlow[]): number | null {
  // Search a wide range of candidate rates for a bracket where NPV changes
  // sign, then bisect down to tolerance.
  const candidates = [-0.99, -0.9, -0.5, -0.2, 0, 0.2, 0.5, 1, 2, 5, 10, 50];
  for (let i = 0; i < candidates.length - 1; i++) {
    let lo = candidates[i];
    let hi = candidates[i + 1];
    const npvLo = npv(flows, lo);
    const npvHi = npv(flows, hi);
    if (!Number.isFinite(npvLo) || !Number.isFinite(npvHi)) continue;
    if (npvLo === 0) return lo;
    if (npvHi === 0) return hi;
    if (Math.sign(npvLo) === Math.sign(npvHi)) continue;

    for (let iter = 0; iter < MAX_BISECTION_ITERATIONS; iter++) {
      const mid = (lo + hi) / 2;
      const npvMid = npv(flows, mid);
      if (Math.abs(npvMid) < BISECTION_TOLERANCE || hi - lo < BISECTION_TOLERANCE) {
        return mid;
      }
      if (Math.sign(npvMid) === Math.sign(npvLo)) {
        lo = mid;
      } else {
        hi = mid;
      }
    }
    return (lo + hi) / 2;
  }
  return null;
}

/**
 * Returns the annualized money-weighted rate of return, or `null` when it
 * isn't computable (fewer than 2 cash flows, no sign change — i.e. no real
 * "invested vs. returned" pair — or no root found within the search range).
 * Never returns a number it isn't confident represents a real root.
 */
export function calculateXIRR(cashflows: ExternalCashflow[]): Decimal | null {
  const nonZero = cashflows.filter((cf) => !cf.amount.isZero());
  if (nonZero.length < 2 || !hasSignChange(nonZero)) return null;

  const flows = toTimedFlows(nonZero);

  let rate = 0.1;
  let converged = false;
  for (let i = 0; i < MAX_NEWTON_ITERATIONS; i++) {
    const value = npv(flows, rate);
    const derivative = npvDerivative(flows, rate);
    if (derivative === 0 || !Number.isFinite(derivative)) break;

    const nextRate = rate - value / derivative;
    if (!Number.isFinite(nextRate) || nextRate <= -1) break;

    if (Math.abs(nextRate - rate) < NEWTON_TOLERANCE) {
      rate = nextRate;
      converged = true;
      break;
    }
    rate = nextRate;
  }

  if (!converged || !Number.isFinite(rate) || rate <= -1) {
    const bisected = bisectionSolve(flows);
    if (bisected === null) return null;
    rate = bisected;
  }

  return new Decimal(rate);
}

/**
 * Simple total return: (endingValue - startingValue + netCashIn) as a
 * fraction of the capital actually at risk. `netExternalCashIn` is deposits
 * minus withdrawals over the period (see `ExternalCashflow`'s sign
 * convention) — required so a mid-period deposit isn't misread as "return".
 */
export function calculateTotalReturn(
  startingValue: Decimal,
  endingValue: Decimal,
  netExternalCashIn: Decimal
): Decimal | null {
  const capitalAtRisk = startingValue.plus(netExternalCashIn);
  if (!capitalAtRisk.greaterThan(0)) return null;
  return endingValue.minus(capitalAtRisk).dividedBy(capitalAtRisk);
}
