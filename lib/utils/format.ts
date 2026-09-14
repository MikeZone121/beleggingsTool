import Decimal from "decimal.js";

type Numeric = Decimal | number | string | null | undefined;

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Decimal ? value : new Decimal(value);
  return d.toNumber();
}

/** €127,438.20 / -€4,821.32 — always 2 decimal places, ISO currency code drives the symbol. */
export function formatCurrency(
  value: Numeric,
  currency: string,
  options: { signDisplay?: "auto" | "always" | "never" } = {}
): string {
  const num = toNumber(value);
  if (num === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    signDisplay: options.signDisplay ?? "auto",
  }).format(num);
}

/** Input is a fraction (0.1243 -> "+12.43%"), not already multiplied by 100. */
export function formatPercent(
  value: Numeric,
  options: { signDisplay?: "auto" | "always" | "never"; decimals?: number } = {}
): string {
  const num = toNumber(value);
  if (num === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "percent",
    minimumFractionDigits: options.decimals ?? 2,
    maximumFractionDigits: options.decimals ?? 2,
    signDisplay: options.signDisplay ?? "auto",
  }).format(num);
}

/** Share/unit quantities: no fixed decimal count, but trims noise past 8dp. */
export function formatQuantity(value: Numeric): string {
  const num = toNumber(value);
  if (num === null) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(num);
}

/**
 * P&L color tone. Uses `.greaterThan(0)`/`.lessThan(0)` rather than
 * Decimal's `isPositive()`/`isNegative()` — those return `true` for exactly
 * zero (its sign is non-negative), which would render a €0.00 P&L in the
 * "positive" color instead of neutral.
 */
export function pnlTone(value: Decimal | null | undefined): "positive" | "negative" | "neutral" {
  if (!value) return "neutral";
  if (value.greaterThan(0)) return "positive";
  if (value.lessThan(0)) return "negative";
  return "neutral";
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}
