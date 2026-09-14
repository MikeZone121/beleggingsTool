import Decimal from "decimal.js";
import type { CurrencyCode, FxRate } from "@/types/domain";

/**
 * Historical FX conversion.
 *
 * Convention: looks up the exchange rate for `date` or the nearest prior
 * date with an available rate (handles weekends/holidays/provider gaps).
 * Never looks forward in time, and never falls back to a 1:1 rate — a
 * missing rate is reported as `null` so callers can flag it explicitly
 * (see `Holding.missingFx`) rather than silently producing a wrong value.
 */
export function findFxRate(
  rates: FxRate[],
  baseCurrency: CurrencyCode,
  quoteCurrency: CurrencyCode,
  date: Date
): Decimal | null {
  if (baseCurrency === quoteCurrency) return new Decimal(1);

  let best: FxRate | null = null;
  for (const rate of rates) {
    if (rate.baseCurrency !== baseCurrency || rate.quoteCurrency !== quoteCurrency) {
      continue;
    }
    if (rate.date.getTime() > date.getTime()) continue;
    if (!best || rate.date.getTime() > best.date.getTime()) {
      best = rate;
    }
  }

  return best?.rate ?? null;
}

/**
 * Converts `amount` (denominated in `fromCurrency`) to `toCurrency` using the
 * nearest-prior-date rate. Returns null (never a guessed value) when no rate
 * is available.
 */
export function convertToBase(
  amount: Decimal,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  date: Date,
  rates: FxRate[]
): Decimal | null {
  const rate = findFxRate(rates, fromCurrency, toCurrency, date);
  if (rate === null) return null;
  return amount.times(rate);
}
