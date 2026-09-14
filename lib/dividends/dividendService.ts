import type Decimal from "decimal.js";
import { listTransactionsForPortfolio } from "@/lib/db/transactions";
import { listExchangeRates } from "@/lib/db/exchangeRates";
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
