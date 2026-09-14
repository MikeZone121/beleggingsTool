import Decimal from "decimal.js";
import type {
  DomainTransaction,
  DividendCashflow,
  DividendYieldResult,
  DividendGrowthResult,
} from "@/types/domain";
import type { FxContext } from "./costBasis";
import { findFxRate } from "./currency";
import { ratioOf, sum, ZERO } from "./money";

/**
 * Dividend income analytics.
 *
 * Everything here is derived from realized `DIVIDEND` transactions — the
 * app has no forward-looking dividend schedule (that needs an external
 * market-data provider, a later phase), so "forward annual income" is
 * intentionally NOT implemented: it would either fabricate a number from
 * incomplete data or require a per-share dividend rate this schema doesn't
 * record. What IS implemented — history, monthly/quarterly/annual/TTM
 * income, current yield, yield-on-cost, YoY growth, CAGR — is exactly what's
 * honestly computable from transactions.
 */

/** Maps a DIVIDEND transaction into a `DividendCashflow`, converting to the
 * base currency via this transaction's own historical FX rate (see
 * costBasis.ts for why — never today's rate for a past cash flow). */
export function toDividendCashflow(
  tx: DomainTransaction,
  fxContext?: FxContext
): DividendCashflow | null {
  if (tx.type !== "DIVIDEND" || tx.securityId === null) return null;

  let netAmountBase: Decimal | null = null;
  if (fxContext) {
    if (tx.currency === fxContext.baseCurrency) {
      netAmountBase = tx.netAmount;
    } else {
      const rate = tx.exchangeRate ?? findFxRate(fxContext.fxRates, tx.currency, fxContext.baseCurrency, tx.date);
      netAmountBase = rate !== null ? tx.netAmount.times(rate) : null;
    }
  }

  return {
    securityId: tx.securityId,
    transactionId: tx.id,
    date: tx.date,
    grossAmount: tx.grossAmount,
    taxes: tx.taxes,
    netAmount: tx.netAmount,
    currency: tx.currency,
    netAmountBase,
  };
}

export interface PeriodIncome {
  /** "2024-03" for month, "2024-Q1" for quarter, "2024" for year. */
  periodKey: string;
  income: Decimal;
  /** True when at least one cashflow in this period had no resolvable FX rate. */
  hasMissingFx: boolean;
}

function periodKeyFor(date: Date, period: "month" | "quarter" | "year"): string {
  const year = date.getUTCFullYear();
  if (period === "year") return String(year);
  if (period === "quarter") return `${year}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`;
  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Groups net (base-currency) dividend income by month/quarter/year,
 * ascending by period. Cashflows with no `netAmountBase` still create/flag
 * the period (via `hasMissingFx`) rather than being silently dropped. */
export function groupIncomeByPeriod(
  cashflows: DividendCashflow[],
  period: "month" | "quarter" | "year"
): PeriodIncome[] {
  const byPeriod = new Map<string, PeriodIncome>();

  for (const cf of cashflows) {
    const key = periodKeyFor(cf.date, period);
    const existing = byPeriod.get(key) ?? { periodKey: key, income: ZERO, hasMissingFx: false };
    if (cf.netAmountBase === null) {
      existing.hasMissingFx = true;
    } else {
      existing.income = existing.income.plus(cf.netAmountBase);
    }
    byPeriod.set(key, existing);
  }

  return Array.from(byPeriod.values()).sort((a, b) => a.periodKey.localeCompare(b.periodKey));
}

/** Trailing-12-month net dividend income as of `asOf` (inclusive window:
 * (asOf - 365 days, asOf]). */
export function calculateTrailingTwelveMonthIncome(
  cashflows: DividendCashflow[],
  asOf: Date
): { total: Decimal; hasMissingFx: boolean } {
  const windowStart = new Date(asOf);
  windowStart.setUTCDate(windowStart.getUTCDate() - 365);

  const inWindow = cashflows.filter(
    (cf) => cf.date.getTime() > windowStart.getTime() && cf.date.getTime() <= asOf.getTime()
  );

  let hasMissingFx = false;
  const amounts: Decimal[] = [];
  for (const cf of inWindow) {
    if (cf.netAmountBase === null) hasMissingFx = true;
    else amounts.push(cf.netAmountBase);
  }

  return { total: sum(amounts), hasMissingFx };
}

/**
 * Current yield and yield-on-cost for one security, both defined as
 * TTM net dividend income (base currency) over the given denominator.
 * Returns null for either ratio when its denominator is missing/zero/null
 * — never a divide-by-zero guess.
 */
export function calculateDividendYield(
  securityId: string,
  cashflows: DividendCashflow[],
  currentMarketValueBase: Decimal | null,
  costBasisBase: Decimal | null,
  asOf: Date
): DividendYieldResult {
  const ttm = calculateTrailingTwelveMonthIncome(cashflows, asOf);

  return {
    securityId,
    currentYield:
      !ttm.hasMissingFx && currentMarketValueBase
        ? ratioOf(ttm.total, currentMarketValueBase)
        : null,
    yieldOnCost:
      !ttm.hasMissingFx && costBasisBase ? ratioOf(ttm.total, costBasisBase) : null,
  };
}

/**
 * Year-over-year dividend income growth and CAGR for one security. A
 * "full year" here means a calendar year that isn't the current
 * (in-progress) year — CAGR needs >= 2 full years, and the first full
 * year's YoY growth is always null (no prior year to compare against).
 */
export function calculateDividendGrowth(
  securityId: string,
  cashflows: DividendCashflow[],
  asOf: Date = new Date()
): DividendGrowthResult {
  const currentYear = asOf.getUTCFullYear();
  const byYear = groupIncomeByPeriod(cashflows, "year")
    .filter((p) => Number(p.periodKey) < currentYear)
    .map((p) => ({ year: Number(p.periodKey), income: p.income, hasMissingFx: p.hasMissingFx }));

  const incomeByYear = byYear.map((y) => ({ year: y.year, income: y.income }));

  const yoyGrowth = byYear.map((y, i) => {
    if (i === 0) return { year: y.year, growth: null };
    const prev = byYear[i - 1];
    if (y.hasMissingFx || prev.hasMissingFx) return { year: y.year, growth: null };
    return { year: y.year, growth: ratioOf(y.income.minus(prev.income), prev.income) };
  });

  let cagr: Decimal | null = null;
  if (byYear.length >= 2) {
    const first = byYear[0];
    const last = byYear[byYear.length - 1];
    const years = last.year - first.year;
    if (
      years > 0 &&
      !first.hasMissingFx &&
      !last.hasMissingFx &&
      first.income.greaterThan(0) &&
      last.income.greaterThan(0)
    ) {
      // CAGR = (last/first)^(1/years) - 1. Uses Math.pow on plain numbers:
      // this is a rate (not a ledger amount), same rationale as XIRR.
      const ratio = last.income.dividedBy(first.income).toNumber();
      cagr = new Decimal(Math.pow(ratio, 1 / years) - 1);
    }
  }

  return { securityId, incomeByYear, yoyGrowth, cagr };
}
