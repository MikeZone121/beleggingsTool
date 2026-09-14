import { listTransactionsForPortfolio } from "@/lib/db/transactions";
import { getSecuritiesByIds } from "@/lib/db/securities";
import { listExchangeRates } from "@/lib/db/exchangeRates";
import { getPortfolioById } from "@/lib/db/portfolios";
import {
  toDomainTransaction,
  toSecurityMeta,
  toCurrentPrice,
  toFxRate,
} from "@/lib/db/mappers";
import { deriveHoldings } from "@/lib/finance/holdings";
import { calculatePortfolioValue, calculateTotalCostBasis, calculateTotalUnrealizedPnL } from "@/lib/finance/portfolioValue";
import { calculateRealizedGains, totalRealizedPnLBase } from "@/lib/finance/realizedPnL";
import { calculateAllocation } from "@/lib/finance/allocation";
import { calculateCashBalance } from "@/lib/finance/cashBalance";
import type { AllocationDimension, CurrentPrice, Holding } from "@/types/domain";

export interface PortfolioSnapshot {
  portfolioId: string;
  baseCurrency: string;
  holdings: Holding[];
  /** Holdings' market value + cash balance, both in the base currency. */
  totalValue: ReturnType<typeof calculatePortfolioValue>;
  cashBalance: ReturnType<typeof calculateCashBalance>;
  totalCostBasis: ReturnType<typeof calculateTotalCostBasis>;
  totalUnrealizedPnL: ReturnType<typeof calculateTotalUnrealizedPnL>;
  totalRealizedPnL: ReturnType<typeof totalRealizedPnLBase>["total"];
  /** True when at least one realized sale's base-currency amount couldn't
   * be resolved (missing historical FX rate) — `totalRealizedPnL` still
   * sums whatever is available, so surface this rather than hide it. */
  realizedPnLHasMissingFx: boolean;
}

/**
 * Orchestrates DB reads + the pure `lib/finance` layer to produce a
 * point-in-time snapshot of a portfolio. This is the only place holdings are
 * derived for reads — API routes and Server Components call this, never
 * `deriveHoldings` directly, so there's a single, auditable code path.
 */
export async function getPortfolioSnapshot(
  userId: string,
  portfolioId: string
): Promise<PortfolioSnapshot> {
  const portfolio = await getPortfolioById(userId, portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  const transactionRows = await listTransactionsForPortfolio(userId, portfolioId);
  const transactions = transactionRows.map(toDomainTransaction);

  const securityIds = Array.from(
    new Set(transactionRows.map((t) => t.securityId).filter((id): id is string => id !== null))
  );
  const securityRows = await getSecuritiesByIds(securityIds);
  const securities = securityRows.map(toSecurityMeta);
  const currentPrices = new Map<string, CurrentPrice>();
  for (const row of securityRows) {
    const price = toCurrentPrice(row);
    if (price) currentPrices.set(row.id, price);
  }

  const fxRateRows = await listExchangeRates();
  const fxRates = fxRateRows.map(toFxRate);

  const holdings = deriveHoldings(
    transactions,
    securities,
    currentPrices,
    fxRates,
    portfolio.baseCurrency
  );

  const fxContext = { baseCurrency: portfolio.baseCurrency, fxRates };
  const realizedGains = calculateRealizedGains(transactions, new Map(), fxContext);
  const realizedPnLBase = totalRealizedPnLBase(realizedGains);
  const cashBalance = calculateCashBalance(transactions, fxContext);

  return {
    portfolioId,
    baseCurrency: portfolio.baseCurrency,
    holdings,
    totalValue: calculatePortfolioValue(holdings, [cashBalance.balanceBase]),
    cashBalance,
    totalCostBasis: calculateTotalCostBasis(holdings),
    totalUnrealizedPnL: calculateTotalUnrealizedPnL(holdings),
    totalRealizedPnL: realizedPnLBase.total,
    realizedPnLHasMissingFx: realizedPnLBase.hasMissingFx,
  };
}

export async function getPortfolioAllocation(
  userId: string,
  portfolioId: string,
  dimension: AllocationDimension
) {
  const snapshot = await getPortfolioSnapshot(userId, portfolioId);
  return calculateAllocation(snapshot.holdings, dimension);
}
