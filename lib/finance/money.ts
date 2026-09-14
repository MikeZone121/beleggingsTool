import Decimal from "decimal.js";

/**
 * Money/quantity arithmetic helpers built on Decimal.js.
 *
 * Rule: nothing in `lib/finance/*` may use native `number` arithmetic on
 * money, quantities, prices, or rates. Values stay as `Decimal` end-to-end;
 * rounding for display only happens in `lib/utils/format.ts`.
 */

export const ZERO = new Decimal(0);

export function toDecimal(value: Decimal | number | string): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

export function sum(values: Decimal[]): Decimal {
  return values.reduce((acc, v) => acc.plus(v), ZERO);
}

export function isZero(value: Decimal): boolean {
  return value.isZero();
}

/**
 * Ratio of `part` to `whole`, expressed as a fraction (e.g. 0.5 = 50%).
 * Returns null instead of dividing by zero.
 */
export function ratioOf(part: Decimal, whole: Decimal): Decimal | null {
  if (whole.isZero()) return null;
  return part.dividedBy(whole);
}

/** Rounds a currency amount to 2 decimal places, half-up. */
export function roundCurrency(value: Decimal): Decimal {
  return value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Rounds a share/unit quantity to 8 decimal places (supports fractional shares/crypto). */
export function roundQuantity(value: Decimal): Decimal {
  return value.toDecimalPlaces(8, Decimal.ROUND_HALF_UP);
}
