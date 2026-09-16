import Decimal from "decimal.js";
import { listTransactionsForPortfolio } from "@/lib/db/transactions";
import { listExchangeRates } from "@/lib/db/exchangeRates";
import { listDividendsForSecurities } from "@/lib/db/dividends";
import { getPortfolioById } from "@/lib/db/portfolios";
import { toDomainTransaction, toFxRate } from "@/lib/db/mappers";
import {
  toDividendCashflow,
  groupIncomeByPeriod,
  calculateTrailingTwelveMonthIncome,
  calculateDividendYield,
  calculateDividendGrowth,
  calculateMonthlySeasonality,
  type PeriodIncome,
  type MonthlySeasonality,
} from "@/lib/finance/dividendMetrics";
import {
  estimateNextDividend,
  estimateDividendPayout,
  type EstimatedDividend,
  type EstimatedDividendPayout,
} from "@/lib/finance/dividendCalendar";
import { convertToBase } from "@/lib/finance/currency";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import type { DividendCashflow, DividendYieldResult, DividendGrowthResult } from "@/types/domain";

export interface DividendSnapshot {
  baseCurrency: string;
  cashflows: DividendCashflow[];
  monthlyIncome: PeriodIncome[];
  annualIncome: PeriodIncome[];
  /** The 12 calendar months with every year folded together — see
   * calculateMonthlySeasonality. */
  seasonality: MonthlySeasonality[];
  ttmIncome: { total: Decimal; hasMissingFx: boolean };
  yieldsBySecurity: Map<string, DividendYieldResult>;
  portfolioGrowth: DividendGrowthResult;
}

/**
 * Orchestrates DB reads + the pure dividend-metrics layer. Mirrors
 * `getPortfolioSnapshot` — the only place dividend analytics are derived,
 * so API routes and Server Components never call `lib/finance/dividendMetrics`
 * directly.
 */
export async function getDividendSnapshot(
  userId: string,
  portfolioId: string,
  asOf: Date = new Date()
): Promise<DividendSnapshot> {
  const portfolio = await getPortfolioById(userId, portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  const transactionRows = await listTransactionsForPortfolio(userId, portfolioId);
  const transactions = transactionRows.map(toDomainTransaction);

  const fxRateRows = await listExchangeRates();
  const fxContext = { baseCurrency: portfolio.baseCurrency, fxRates: fxRateRows.map(toFxRate) };

  const cashflows = transactions
    .map((tx) => toDividendCashflow(tx, fxContext))
    .filter((cf): cf is DividendCashflow => cf !== null)
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const monthlyIncome = groupIncomeByPeriod(cashflows, "month");
  const annualIncome = groupIncomeByPeriod(cashflows, "year");
  const seasonality = calculateMonthlySeasonality(cashflows);
  const ttmIncome = calculateTrailingTwelveMonthIncome(cashflows, asOf);
  const portfolioGrowth = calculateDividendGrowth("__portfolio__", cashflows, asOf);

  const snapshot = await getPortfolioSnapshot(userId, portfolioId);
  const yieldsBySecurity = new Map<string, DividendYieldResult>();
  for (const holding of snapshot.holdings) {
    const securityCashflows = cashflows.filter((cf) => cf.securityId === holding.securityId);
    yieldsBySecurity.set(
      holding.securityId,
      calculateDividendYield(
        holding.securityId,
        securityCashflows,
        holding.marketValueBase,
        holding.costBasisBase,
        asOf
      )
    );
  }

  return {
    baseCurrency: portfolio.baseCurrency,
    cashflows,
    monthlyIncome,
    annualIncome,
    seasonality,
    ttmIncome,
    yieldsBySecurity,
    portfolioGrowth,
  };
}

const DAY_MS = 86_400_000;

export interface DividendCalendarRow {
  securityId: string;
  ticker: string;
  name: string;
  currency: string;
  quantity: Decimal;
  estimate: EstimatedDividend;
  /** The next projected payout for the quantity currently held, converted
   * to the portfolio's base currency and, from there, split into gross/
   * withholding-tax/net at the portfolio's configured rate (see
   * `estimateDividendPayout`). */
  payout: EstimatedDividendPayout;
  /** Whole days from today to the estimated ex-date. Computed here rather
   * than in a component because reading the clock during render is
   * impure (React Compiler flags it) — and this way the count can never
   * disagree with the date it's rendered beside. */
  daysUntilExDate: number;
}

/**
 * Projects each currently-held security's next ex-dividend date/amount from
 * its synced paid-dividend history (see `dividendSyncService.ts`). A
 * security with no history yet (never synced, or a provider with no
 * dividend data) is simply omitted rather than shown with a guess.
 */
export async function getDividendCalendar(
  userId: string,
  portfolioId: string
): Promise<DividendCalendarRow[]> {
  const portfolio = await getPortfolioById(userId, portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  const snapshot = await getPortfolioSnapshot(userId, portfolioId);
  const heldHoldings = snapshot.holdings.filter((h) => h.quantity.greaterThan(0));

  const dividendRows = await listDividendsForSecurities(heldHoldings.map((h) => h.securityId));
  const historyBySecurity = new Map<string, { exDividendDate: Date; dividendPerShare: Decimal }[]>();
  for (const row of dividendRows) {
    const list = historyBySecurity.get(row.securityId) ?? [];
    list.push({ exDividendDate: row.exDividendDate, dividendPerShare: new Decimal(row.dividendPerShare) });
    historyBySecurity.set(row.securityId, list);
  }

  const fxRateRows = await listExchangeRates();
  const fxRates = fxRateRows.map(toFxRate);
  const today = new Date();
  const withholdingRate = new Decimal(portfolio.dividendTaxRate.toString());

  const calendar: DividendCalendarRow[] = [];
  for (const holding of heldHoldings) {
    const estimate = estimateNextDividend(historyBySecurity.get(holding.securityId) ?? []);
    if (!estimate) continue;

    const grossOwnCurrency = estimate.estimatedAmountPerShare.times(holding.quantity);
    const grossBase = convertToBase(
      grossOwnCurrency,
      holding.currency,
      portfolio.baseCurrency,
      today,
      fxRates
    );

    calendar.push({
      securityId: holding.securityId,
      ticker: holding.ticker,
      name: holding.name,
      currency: holding.currency,
      quantity: holding.quantity,
      estimate,
      payout: estimateDividendPayout(grossBase, withholdingRate),
      daysUntilExDate: Math.ceil(
        (estimate.estimatedNextExDate.getTime() - today.getTime()) / DAY_MS
      ),
    });
  }

  return calendar.sort(
    (a, b) => a.estimate.estimatedNextExDate.getTime() - b.estimate.estimatedNextExDate.getTime()
  );
}

/** How far ahead the dashboard's dividend card looks. A month is the span
 * worth planning around — long enough that a quarterly payer usually has
 * something in it, short enough that everything in it is still a reasonable
 * projection rather than a guess three cadences out. */
export const DIVIDEND_OUTLOOK_WINDOW_DAYS = 30;

export interface DividendOutlook {
  windowDays: number;
  /** Projected payments from today through `windowDays`, soonest first. */
  upcoming: DividendCalendarRow[];
  /** Total estimated net across `upcoming`, in the base currency. */
  totalNetBase: Decimal;
  /** True when a payment in the window had no FX rate, so the total covers
   * only part of the window. */
  hasMissingFx: boolean;
  /** The nearest upcoming payment even when it falls beyond the window, so
   * the card can still say when the next one is rather than going blank. */
  next: DividendCalendarRow | null;
}

/**
 * Narrows the full projection table (see `getDividendCalendar`) to the
 * dashboard's look-ahead window and totals it.
 *
 * Pure, and separate from the query, so the window is one constant rather
 * than a filter condition repeated per caller.
 */
export function summarizeDividendOutlook(
  rows: DividendCalendarRow[],
  windowDays: number = DIVIDEND_OUTLOOK_WINDOW_DAYS
): DividendOutlook {
  // A projection is `lastExDate + interval`, which lands in the *past* for
  // a security whose dividend history hasn't been synced in a while (or
  // that quietly stopped paying). Those are stale guesses, not upcoming
  // payments — dropping them here keeps them out of the total and stops
  // the card announcing a payment "today" for a date months gone.
  const upcomingAll = rows.filter((row) => row.daysUntilExDate >= 0);
  const upcoming = upcomingAll.filter((row) => row.daysUntilExDate <= windowDays);

  let totalNetBase = new Decimal(0);
  let hasMissingFx = false;
  for (const row of upcoming) {
    if (row.payout.netBase === null) {
      hasMissingFx = true;
      continue;
    }
    totalNetBase = totalNetBase.plus(row.payout.netBase);
  }

  return {
    windowDays,
    upcoming,
    totalNetBase,
    hasMissingFx,
    next: upcomingAll.at(0) ?? null,
  };
}
