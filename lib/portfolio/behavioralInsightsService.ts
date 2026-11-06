import { getPortfolioSnapshot } from "./holdingsService";
import { listTransactionsForPortfolio } from "@/lib/db/transactions";
import { listExchangeRates } from "@/lib/db/exchangeRates";
import { toDomainTransaction, toFxRate } from "@/lib/db/mappers";
import { calculateRealizedGains } from "@/lib/finance/realizedPnL";
import { calculateBehavioralInsights, type BehavioralInsight } from "@/lib/finance/behavioralInsights";
import { loadSplitsBySecurity } from "./splitService";

export async function getBehavioralInsights(
  userId: string,
  portfolioId: string
): Promise<BehavioralInsight[]> {
  const [snapshot, transactionRows, fxRateRows] = await Promise.all([
    getPortfolioSnapshot(userId, portfolioId),
    listTransactionsForPortfolio(userId, portfolioId),
    listExchangeRates(),
  ]);

  const transactions = transactionRows.map(toDomainTransaction);
  const fxContext = { baseCurrency: snapshot.baseCurrency, fxRates: fxRateRows.map(toFxRate) };
  const securityIds = Array.from(
    new Set(transactionRows.map((t) => t.securityId).filter((id): id is string => id !== null))
  );
  const { splitsBySecurity } = await loadSplitsBySecurity(securityIds);
  const realizedGains = calculateRealizedGains(transactions, splitsBySecurity, fxContext);
  const realizedGainsCount = realizedGains.filter((g) => g.realizedPnL.isPositive()).length;
  const realizedLossesCount = realizedGains.filter((g) => g.realizedPnL.isNegative()).length;

  return calculateBehavioralInsights({
    holdings: snapshot.holdings,
    totalValueBase: snapshot.totalValue,
    cashBalanceBase: snapshot.cashBalance.balanceBase,
    baseCurrency: snapshot.baseCurrency,
    realizedGainsCount,
    realizedLossesCount,
  });
}
