import Decimal from "decimal.js";
import { getPortfolioSnapshot } from "./holdingsService";
import { getPreviousClosePrices } from "@/lib/db/prices";
import { listExchangeRates } from "@/lib/db/exchangeRates";
import { toFxRate } from "@/lib/db/mappers";
import { convertToBase } from "@/lib/finance/currency";

export interface TodayMoverRow {
  securityId: string;
  ticker: string;
  name: string;
  dayChangePercent: string;
}

export interface TodaySummary {
  /** Every holding with a resolvable prior close, sorted by the size of
   * the move (largest first, gains and losses mixed — this is "what
   * moved today", not "what's up today"). */
  rows: TodayMoverRow[];
  /** Signed, in the portfolio's base currency. Null when no holding had
   * both a live price and a prior close to compare against. */
  totalChangeBase: string | null;
  /** `totalChangeBase` relative to yesterday's holdings value (cash is
   * excluded — it doesn't move intraday). */
  totalChangePercent: string | null;
  hasData: boolean;
}

/**
 * "What happened to my portfolio today" — each holding's live price vs.
 * its most recent prior close (see `getPreviousClosePrices` for why that's
 * market-calendar-aware across EU/US/CA), rolled up into one signed
 * total. Reuses the exact comparison the Portfolio table's Current Price
 * coloring already makes per row (see holdings-table.tsx), just
 * aggregated here instead of rendered per row.
 */
export async function getTodaySummary(userId: string, portfolioId: string): Promise<TodaySummary> {
  const snapshot = await getPortfolioSnapshot(userId, portfolioId);
  const previousCloses = await getPreviousClosePrices(
    snapshot.holdings.map((h) => h.securityId),
    new Date()
  );
  const fxRateRows = await listExchangeRates();
  const fxRates = fxRateRows.map(toFxRate);
  const today = new Date();

  const rows: TodayMoverRow[] = [];
  let totalChangeBase = new Decimal(0);
  let totalPrevValueBase = new Decimal(0);
  let hasData = false;

  for (const holding of snapshot.holdings) {
    if (!holding.marketValue || holding.quantity.isZero()) continue;
    const previousCloseStr = previousCloses.get(holding.securityId);
    if (!previousCloseStr) continue;
    const previousClose = new Decimal(previousCloseStr);
    if (previousClose.isZero()) continue;

    const currentPrice = holding.marketValue.dividedBy(holding.quantity);
    const changePerShare = currentPrice.minus(previousClose);

    hasData = true;
    rows.push({
      securityId: holding.securityId,
      ticker: holding.ticker,
      name: holding.name,
      dayChangePercent: changePerShare.dividedBy(previousClose).toString(),
    });

    const changeAbsBase = convertToBase(
      changePerShare.times(holding.quantity),
      holding.currency,
      snapshot.baseCurrency,
      today,
      fxRates
    );
    const previousValueBase = convertToBase(
      previousClose.times(holding.quantity),
      holding.currency,
      snapshot.baseCurrency,
      today,
      fxRates
    );
    if (changeAbsBase) totalChangeBase = totalChangeBase.plus(changeAbsBase);
    if (previousValueBase) totalPrevValueBase = totalPrevValueBase.plus(previousValueBase);
  }

  rows.sort((a, b) => Math.abs(Number(b.dayChangePercent)) - Math.abs(Number(a.dayChangePercent)));

  return {
    rows,
    totalChangeBase: hasData ? totalChangeBase.toString() : null,
    totalChangePercent:
      hasData && totalPrevValueBase.greaterThan(0)
        ? totalChangeBase.dividedBy(totalPrevValueBase).toString()
        : null,
    hasData,
  };
}
