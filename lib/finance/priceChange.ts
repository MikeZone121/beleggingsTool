import Decimal from "decimal.js";

/**
 * How a current price compares to the previous session's close, and when a
 * price is old enough to warn about. Shared so the Watchlist table, a
 * security's own page and the Portfolio holdings can't drift into showing
 * three slightly different numbers for the same thing.
 */

/** "Stale" is intentionally coarse (manual price entry / daily refresh
 * cadence): a price older than 24h is flagged rather than treated as
 * wrong. */
export const PRICE_STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export function isPriceStale(asOf: Date, now: Date = new Date()): boolean {
  return now.getTime() - asOf.getTime() > PRICE_STALE_AFTER_MS;
}

/**
 * Day-over-day change as a fraction (0.0123 = +1.23%): the current price
 * against the previous session's close. Null — never zero — when either
 * side is missing or the previous close is zero, so "no data" can't be
 * mistaken for "unchanged".
 */
export function dayChangeFraction(
  currentPrice: Decimal | null | undefined,
  previousClose: Decimal | string | null | undefined
): Decimal | null {
  if (!currentPrice || previousClose === null || previousClose === undefined) return null;
  const close = previousClose instanceof Decimal ? previousClose : new Decimal(previousClose);
  if (close.isZero()) return null;
  return currentPrice.minus(close).dividedBy(close);
}
