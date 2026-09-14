import Decimal from "decimal.js";
import { listTransactionsForPortfolio } from "@/lib/db/transactions";
import { listExchangeRates } from "@/lib/db/exchangeRates";
import { getPortfolioById } from "@/lib/db/portfolios";
import { toDomainTransaction, toFxRate } from "@/lib/db/mappers";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import { calculateXIRR, calculateTotalReturn } from "@/lib/finance/returns";
import { findFxRate } from "@/lib/finance/currency";
import type { ExternalCashflow } from "@/types/domain";

export interface PerformanceSnapshot {
  baseCurrency: string;
  /** Money-weighted return (XIRR), annualized. Null when not computable —
   * see calculateXIRR (needs a real invested/returned pair). */
  xirr: Decimal | null;
  /** Simple total return over the full recorded history: ending value vs.
   * net external cash actually contributed (deposits minus withdrawals). */
  totalReturn: Decimal | null;
  netExternalCashIn: Decimal;
  currentValue: Decimal;
  hasMissingFx: boolean;
}

/**
 * External cash flows for money-weighted return, from the *investor's*
 * perspective (opposite convention from `calculateCashBalance`, which is
 * from the account's perspective): a DEPOSIT is money leaving the investor
 * (negative), a WITHDRAWAL is money returned to them (positive). BUY/SELL/
 * DIVIDEND/FEE/etc. are internal to the account and already reflected in
 * the terminal portfolio value, so they are not separate external flows.
 */
export async function getPerformanceSnapshot(
  userId: string,
  portfolioId: string,
  asOf: Date = new Date()
): Promise<PerformanceSnapshot> {
  const portfolio = await getPortfolioById(userId, portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  const transactionRows = await listTransactionsForPortfolio(userId, portfolioId);
  const transactions = transactionRows.map(toDomainTransaction);
  const fxRateRows = await listExchangeRates();
  const fxRates = fxRateRows.map(toFxRate);

  let hasMissingFx = false;
  const externalCashflows: ExternalCashflow[] = [];
  let netExternalCashIn = new Decimal(0);

  for (const tx of transactions) {
    if (tx.type !== "DEPOSIT" && tx.type !== "WITHDRAWAL") continue;

    const rate =
      tx.currency === portfolio.baseCurrency
        ? new Decimal(1)
        : (tx.exchangeRate ?? findFxRate(fxRates, tx.currency, portfolio.baseCurrency, tx.date));
    if (rate === null) {
      hasMissingFx = true;
      continue;
    }

    const amountBase = tx.netAmount.times(rate);
    const signedAmount = tx.type === "DEPOSIT" ? amountBase.negated() : amountBase;
    externalCashflows.push({ date: tx.date, amount: signedAmount });
    netExternalCashIn = netExternalCashIn.plus(tx.type === "DEPOSIT" ? amountBase : amountBase.negated());
  }

  const snapshot = await getPortfolioSnapshot(userId, portfolioId);
  const currentValue = snapshot.totalValue;

  const allFlows = [...externalCashflows, { date: asOf, amount: currentValue }];
  const xirr = calculateXIRR(allFlows);

  // Simple total return needs a "starting value" — with no daily valuation
  // history (Phase 7), the earliest we can honestly call "starting" is 0
  // (before any external cash was contributed).
  const totalReturn = calculateTotalReturn(new Decimal(0), currentValue, netExternalCashIn);

  return {
    baseCurrency: portfolio.baseCurrency,
    xirr,
    totalReturn,
    netExternalCashIn,
    currentValue,
    hasMissingFx,
  };
}
