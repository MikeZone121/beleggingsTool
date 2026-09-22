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

/** Units big enough to matter for "how fresh is this price?", largest
 * first — anything under a minute reads as "just now". */
const RELATIVE_UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

/**
 * "3 hours ago" / "in 2 days", in the user's own locale. Used for data
 * freshness, where the exact timestamp matters less than whether it is
 * minutes or weeks old — a formatted date can't distinguish "this
 * morning's price" from "this morning a month ago" at a glance.
 */
export function formatRelativeTime(
  value: Date | string | null | undefined,
  options: { locale?: string; now?: Date } = {}
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const elapsed = (options.now ?? new Date()).getTime() - date.getTime();
  const formatter = new Intl.RelativeTimeFormat(options.locale ?? DEFAULT_LOCALE, {
    numeric: "auto",
  });
  for (const [unit, ms] of RELATIVE_UNITS) {
    if (Math.abs(elapsed) >= ms) {
      // Negative = in the past, which is what RelativeTimeFormat expects.
      return formatter.format(-Math.round(elapsed / ms), unit);
    }
  }
  // Seconds, not minutes, for the sub-minute case: `format(0, "minute")`
  // renders as "binnen een minuut" / "this minute", which reads like a
  // prediction rather than "just now".
  return formatter.format(0, "second");
}

/** Tailwind text colour for a gain/loss, light and dark — kept next to
 * `pnlTone` so the tables, KPI cards and detail headers that all colour a
 * number this way can't drift into different greens. Empty string for a
 * neutral value, so callers can drop it into a class list unconditionally. */
export function pnlToneClass(value: Numeric): string {
  if (value === null || value === undefined || value === "") return "";
  const tone = pnlTone(value instanceof Decimal ? value : new Decimal(value));
  if (tone === "positive") return "text-emerald-600 dark:text-emerald-400";
  if (tone === "negative") return "text-red-600 dark:text-red-400";
  return "";
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
