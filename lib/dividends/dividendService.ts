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
  type PeriodIncome,
} from "@/lib/finance/dividendMetrics";
import { estimateNextDividend, type EstimatedDividend } from "@/lib/finance/dividendCalendar";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import type { DividendCashflow, DividendYieldResult, DividendGrowthResult } from "@/types/domain";

export interface DividendSnapshot {
  baseCurrency: string;
  cashflows: DividendCashflow[];
  monthlyIncome: PeriodIncome[];
  annualIncome: PeriodIncome[];
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
    ttmIncome,
    yieldsBySecurity,
    portfolioGrowth,
  };
}

export interface DividendCalendarRow {
  securityId: string;
  ticker: string;
  name: string;
  currency: string;
  estimate: EstimatedDividend;
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
  const snapshot = await getPortfolioSnapshot(userId, portfolioId);
  const heldHoldings = snapshot.holdings.filter((h) => h.quantity.greaterThan(0));

  const dividendRows = await listDividendsForSecurities(heldHoldings.map((h) => h.securityId));
  const historyBySecurity = new Map<string, { exDividendDate: Date; dividendPerShare: Decimal }[]>();
  for (const row of dividendRows) {
    const list = historyBySecurity.get(row.securityId) ?? [];
    list.push({ exDividendDate: row.exDividendDate, dividendPerShare: new Decimal(row.dividendPerShare) });
    historyBySecurity.set(row.securityId, list);
  }

  const calendar: DividendCalendarRow[] = [];
  for (const holding of heldHoldings) {
    const estimate = estimateNextDividend(historyBySecurity.get(holding.securityId) ?? []);
    if (!estimate) continue;
    calendar.push({
      securityId: holding.securityId,
      ticker: holding.ticker,
      name: holding.name,
      currency: holding.currency,
      estimate,
    });
  }

  return calendar.sort(
    (a, b) => a.estimate.estimatedNextExDate.getTime() - b.estimate.estimatedNextExDate.getTime()
  );
}
