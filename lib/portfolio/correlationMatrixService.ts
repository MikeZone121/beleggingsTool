import Decimal from "decimal.js";
import { getPortfolioSnapshot } from "./holdingsService";
import { listPricesForSecurities } from "@/lib/db/prices";
import { calculatePearsonCorrelation, type ClosePricePoint } from "@/lib/finance/correlation";

export interface CorrelationCell {
  tickerA: string;
  tickerB: string;
  /** `null` when there isn't enough overlapping price history for that
   * pair yet — rendered as "—", never guessed at. */
  correlation: number | null;
}

export interface CorrelationMatrix {
  tickers: string[];
  /** A plain array rather than a lookup map — this crosses the Server ->
   * Client Component boundary as a prop, so it stays in the same "plain
   * serializable data" shape every other chart/table prop in this app
   * uses (see SecurityChartPoint etc.); the client can build its own
   * lookup if it needs one. */
  cells: CorrelationCell[];
}

/**
 * Pairwise correlation of daily returns across every currently-held
 * security — the point is surfacing "hidden" concentration the
 * Allocation card's asset-type/sector buckets can't: two holdings in
 * different buckets (e.g. a tech stock and a broad tech ETF) can still
 * move almost in lockstep, which isn't a real diversification benefit
 * even though the pie chart makes it look like two separate bets.
 */
export async function getCorrelationMatrix(userId: string, portfolioId: string): Promise<CorrelationMatrix> {
  const snapshot = await getPortfolioSnapshot(userId, portfolioId);
  const holdings = snapshot.holdings.filter((h) => h.quantity.greaterThan(0));

  const cells: CorrelationCell[] = [];
  if (holdings.length < 2) {
    return { tickers: holdings.map((h) => h.ticker), cells };
  }

  const priceRows = await listPricesForSecurities(holdings.map((h) => h.securityId));
  const pricesBySecurity = new Map<string, ClosePricePoint[]>();
  for (const row of priceRows) {
    const list = pricesBySecurity.get(row.securityId) ?? [];
    list.push({ date: row.date, close: new Decimal(row.close.toString()) });
    pricesBySecurity.set(row.securityId, list);
  }

  for (let i = 0; i < holdings.length; i++) {
    for (let j = 0; j < holdings.length; j++) {
      const a = holdings[i];
      const b = holdings[j];
      if (i === j) {
        cells.push({ tickerA: a.ticker, tickerB: b.ticker, correlation: 1 });
        continue;
      }
      const correlation = calculatePearsonCorrelation(
        pricesBySecurity.get(a.securityId) ?? [],
        pricesBySecurity.get(b.securityId) ?? []
      );
      cells.push({ tickerA: a.ticker, tickerB: b.ticker, correlation: correlation?.toNumber() ?? null });
    }
  }

  return { tickers: holdings.map((h) => h.ticker), cells };
}
