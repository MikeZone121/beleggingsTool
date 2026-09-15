import Decimal from "decimal.js";
import { listWatchlist } from "@/lib/db/watchlist";
import { getPreviousClosePrices } from "@/lib/db/prices";
import { toCurrentPrice } from "@/lib/db/mappers";

export interface WatchlistRow {
  id: string;
  securityId: string;
  ticker: string;
  name: string;
  currency: string;
  currentPrice: string | null;
  priceStale: boolean;
  dayChangePercent: string | null;
  notes: string | null;
  targetPrice: string | null;
  /** True once `currentPrice` is at or below `targetPrice` — purely
   * visual, no email/push (see WatchlistItem.targetPrice in schema.prisma). */
  targetReached: boolean;
}

/**
 * A watched security carries no transactions, so it has none of the
 * cost-basis/P&L machinery `getPortfolioSnapshot` builds — just whatever
 * `Security.currentPrice` the same refresh-prices job already keeps
 * current, plus the same day-over-day comparison the Portfolio table
 * uses (see getPreviousClosePrices).
 */
export async function getWatchlistSnapshot(userId: string): Promise<WatchlistRow[]> {
  const items = await listWatchlist(userId);
  if (items.length === 0) return [];

  const previousCloses = await getPreviousClosePrices(
    items.map((item) => item.securityId),
    new Date()
  );

  return items.map((item) => {
    const currentPrice = toCurrentPrice(item.security);
    const previousClose = previousCloses.get(item.securityId);
    const dayChangePercent =
      currentPrice && previousClose && !new Decimal(previousClose).isZero()
        ? currentPrice.price.minus(previousClose).dividedBy(previousClose)
        : null;
    // Same 24h staleness threshold as deriveHoldings (lib/finance/holdings.ts).
    const priceStale = currentPrice
      ? new Date().getTime() - currentPrice.asOf.getTime() > 24 * 60 * 60 * 1000
      : false;
    const targetPrice = item.targetPrice ? new Decimal(item.targetPrice.toString()) : null;
    const targetReached = Boolean(
      currentPrice && targetPrice && currentPrice.price.lessThanOrEqualTo(targetPrice)
    );

    return {
      id: item.id,
      securityId: item.securityId,
      ticker: item.security.ticker,
      name: item.security.name,
      currency: item.security.currency,
      currentPrice: currentPrice?.price.toString() ?? null,
      priceStale,
      dayChangePercent: dayChangePercent?.toString() ?? null,
      notes: item.notes,
      targetPrice: targetPrice?.toString() ?? null,
      targetReached,
    };
  });
}
