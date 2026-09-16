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
  estimateBelgianDividendPayout,
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
   * Belgian-withholding-tax/net (see `estimateBelgianDividendPayout`). */
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
      payout: estimateBelgianDividendPayout(grossBase),
      daysUntilExDate: Math.ceil(
        (estimate.estimatedNextExDate.getTime() - today.getTime()) / DAY_MS
      ),
    });
  }

  return calendar.sort(
    (a, b) => a.estimate.estimatedNextExDate.getTime() - b.estimate.estimatedNextExDate.getTime()
  );
}
