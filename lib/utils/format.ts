import Decimal from "decimal.js";

type Numeric = Decimal | number | string | null | undefined;

/**
 * Locale used when a caller passes none. Every formatter here takes an
 * optional `locale` so the user's own preference (`User.locale`, set in
 * Settings and supplied to client components by `LocaleProvider`) drives
 * grouping separators, decimal commas, currency-symbol placement and month
 * names. Display only — it never touches a stored value or any Decimal
 * math.
 */
export const DEFAULT_LOCALE = "en-US";

function toNumber(value: Numeric): number | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Decimal ? value : new Decimal(value);
  return d.toNumber();
}

/** €127,438.20 / -€4,821.32 (en-US) or 127.438,20 € (nl-BE) — always 2
 * decimal places, ISO currency code drives the symbol. */
export function formatCurrency(
  value: Numeric,
  currency: string,
  options: { signDisplay?: "auto" | "always" | "never"; locale?: string } = {}
): string {
  const num = toNumber(value);
  if (num === null) return "—";
  return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
    style: "currency",
    currency,
    signDisplay: options.signDisplay ?? "auto",
  }).format(num);
}

/** Input is a fraction (0.1243 -> "+12.43%"), not already multiplied by 100. */
export function formatPercent(
  value: Numeric,
  options: {
    signDisplay?: "auto" | "always" | "never";
    decimals?: number;
    locale?: string;
  } = {}
): string {
  const num = toNumber(value);
  if (num === null) return "—";
  return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
    style: "percent",
    minimumFractionDigits: options.decimals ?? 2,
    maximumFractionDigits: options.decimals ?? 2,
    signDisplay: options.signDisplay ?? "auto",
  }).format(num);
}

/** Share/unit quantities: no fixed decimal count, but trims noise past 8dp. */
export function formatQuantity(value: Numeric, options: { locale?: string } = {}): string {
  const num = toNumber(value);
  if (num === null) return "—";
  return new Intl.NumberFormat(options.locale ?? DEFAULT_LOCALE, {
    maximumFractionDigits: 8,
  }).format(num);
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

export function formatDate(
  value: Date | string | null | undefined,
  options: { locale?: string } = {}
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat(options.locale ?? DEFAULT_LOCALE, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}
