import { z } from "zod";
import Decimal from "decimal.js";

/**
 * Normalizes a European-style decimal comma ("115,50") to a dot ("115.50")
 * before parsing — every numeric field in the app (price, quantity, fees,
 * taxes, current price) goes through this, so a Belgian/European keyboard's
 * natural input never trips validation. Only the *first* comma is replaced
 * (JS `String.replace` without `/g`): a second stray comma is genuinely
 * invalid input and should still fail the `Decimal` check below, not be
 * silently mangled into something that happens to parse.
 */
function normalizeDecimalInput(value: string): string {
  return value.trim().replace(",", ".");
}

function isFiniteDecimal(value: string): boolean {
  try {
    return new Decimal(value).isFinite();
  } catch {
    return false;
  }
}

/** Any finite decimal (may be negative), comma-or-dot. */
export const decimalString = z
  .string()
  .min(1, "Required")
  .transform(normalizeDecimalInput)
  .refine(isFiniteDecimal, "Must be a valid number");

/**
 * A finite decimal that must be greater than zero, comma-or-dot.
 *
 * This refine independently re-checks parseability (with its own try/catch)
 * rather than assuming `decimalString`'s refine already ran and passed:
 * Zod does not short-circuit chained `.refine()` calls — an invalid string
 * still reaches this one, and `new Decimal(...)` throws (uncaught) on
 * unparseable input, which would otherwise crash the request instead of
 * producing a normal validation error.
 */
export const positiveDecimalString = decimalString.refine((val) => {
  try {
    return new Decimal(val).greaterThan(0);
  } catch {
    return false;
  }
}, "Must be greater than 0");

/** A fraction between 0 and 1 inclusive (0.6 = 60%) — for weights/targets
 * stored the same way `AllocationBucket.weight` already is. */
export const fractionString = decimalString.refine((val) => {
  try {
    const d = new Decimal(val);
    return d.greaterThanOrEqualTo(0) && d.lessThanOrEqualTo(1);
  } catch {
    return false;
  }
}, "Must be between 0 and 1");
