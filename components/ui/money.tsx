"use client";

import { usePrivacyMode } from "@/components/privacy-mode-provider";
import { formatCurrency, formatPercent, formatQuantity } from "@/lib/utils/format";

/** A fixed-width mask — never sized to the real value, so even the number
 * of digits doesn't leak through when privacy mode is on. */
const MASK = "•••••";

type Numeric = string | number | null | undefined;

interface MoneyProps {
  value: Numeric;
  currency: string;
  signDisplay?: "auto" | "always" | "never";
  className?: string;
}

/** Renders a currency amount, or a fixed mask when privacy mode is on.
 * `value` must already be a plain string/number (e.g. `decimal.toString()`)
 * — Decimal instances aren't serializable across the Server->Client
 * Component boundary. */
export function Money({ value, currency, signDisplay, className }: MoneyProps) {
  const { hidden } = usePrivacyMode();
  if (hidden) return <span className={className}>{MASK}</span>;
  return <span className={className}>{formatCurrency(value, currency, { signDisplay })}</span>;
}

interface PercentProps {
  value: Numeric;
  signDisplay?: "auto" | "always" | "never";
  decimals?: number;
  className?: string;
}

export function Percent({ value, signDisplay, decimals, className }: PercentProps) {
  const { hidden } = usePrivacyMode();
  if (hidden) return <span className={className}>{MASK}</span>;
  return <span className={className}>{formatPercent(value, { signDisplay, decimals })}</span>;
}

interface QuantityProps {
  value: Numeric;
  className?: string;
}

export function Quantity({ value, className }: QuantityProps) {
  const { hidden } = usePrivacyMode();
  if (hidden) return <span className={className}>{MASK}</span>;
  return <span className={className}>{formatQuantity(value)}</span>;
}
