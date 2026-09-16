import Decimal from "decimal.js";
import { getSecurityById } from "@/lib/db/securities";
import { listPricesForSecurities } from "@/lib/db/prices";
import { calculateSMA, calculateFibonacciLevels } from "@/lib/finance/technicalIndicators";

export interface SecurityChartPoint {
  date: string;
  close: number;
  /** Null when the provider/backfill didn't return an intraday range for
   * this day — the candlestick view simply skips that day rather than
   * guessing a range from the close alone. */
  open: number | null;
  high: number | null;
  low: number | null;
  sma25: number | null;
  sma50: number | null;
  sma100: number | null;
}

export interface SecurityFibonacciLevel {
  label: string;
  price: number;
}

export interface SecurityChartData {
  securityId: string;
  ticker: string;
  name: string;
  currency: string;
  points: SecurityChartPoint[];
  /** Empty when there's no cached price history at all yet. */
  fibonacciLevels: SecurityFibonacciLevel[];
}

/**
 * A security's cached daily-close history (see priceHistorySyncService.ts)
 * with SMA 25/50/100 and a Fibonacci retracement grid — the swing
 * high/low for the retracement is simply the max/min close over whatever
 * history is cached, not a hand-picked "recent swing", so it moves as
 * more history backfills in rather than needing a separate pivot-
 * detection algorithm.
 */
export async function getSecurityChartData(securityId: string): Promise<SecurityChartData | null> {
  const security = await getSecurityById(securityId);
  if (!security) return null;

  const priceRows = await listPricesForSecurities([securityId]);
  if (priceRows.length === 0) {
    return {
      securityId,
      ticker: security.ticker,
      name: security.name,
      currency: security.currency,
      points: [],
      fibonacciLevels: [],
    };
  }

  const prices = priceRows.map((row) => ({
    date: row.date,
    close: new Decimal(row.close.toString()),
    open: row.open ? new Decimal(row.open.toString()) : null,
    high: row.high ? new Decimal(row.high.toString()) : null,
    low: row.low ? new Decimal(row.low.toString()) : null,
  }));
  const sma25 = calculateSMA(prices, 25);
  const sma50 = calculateSMA(prices, 50);
  const sma100 = calculateSMA(prices, 100);

  let high = prices[0].close;
  let low = prices[0].close;
  for (const p of prices) {
    if (p.close.greaterThan(high)) high = p.close;
    if (p.close.lessThan(low)) low = p.close;
  }
  const fibonacciLevels = calculateFibonacciLevels(high, low).map((level) => ({
    label: level.label,
    price: level.price.toNumber(),
  }));

  const points: SecurityChartPoint[] = prices.map((p, i) => ({
    date: p.date.toISOString().slice(0, 10),
    close: p.close.toNumber(),
    open: p.open?.toNumber() ?? null,
    high: p.high?.toNumber() ?? null,
    low: p.low?.toNumber() ?? null,
    sma25: sma25[i].value?.toNumber() ?? null,
    sma50: sma50[i].value?.toNumber() ?? null,
    sma100: sma100[i].value?.toNumber() ?? null,
  }));

  return {
    securityId,
    ticker: security.ticker,
    name: security.name,
    currency: security.currency,
    points,
    fibonacciLevels,
  };
}
