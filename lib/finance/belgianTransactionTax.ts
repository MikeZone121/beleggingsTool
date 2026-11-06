import Decimal from "decimal.js";
import type { AssetType } from "@/generated/prisma/client";
import { ZERO } from "./money";

/**
 * Belgian tax on stock-exchange transactions ("taks op beursverrichtingen"
 * / TOB), the per-trade tax a Belgian-resident investor owes on every buy
 * *and* every sell. A Belgian broker (Bolero, Keytrade, …) withholds and
 * files it; a foreign one (DEGIRO, IBKR, Trade Republic) generally does
 * not, leaving the investor to declare it themselves — which is the main
 * reason this app estimates it rather than only reading it off a
 * statement.
 *
 * The rate depends on the instrument, not on the amount:
 *  - 0.12% — bonds, and the distributing share class of a fund registered
 *    in Belgium.
 *  - 0.35% — shares, and funds *not* registered in Belgium (which covers
 *    most ETFs a Belgian retail investor holds: IWDA, VWCE and friends are
 *    Irish- or Luxembourg-domiciled).
 *  - 1.32% — the accumulating share class of a fund registered in Belgium.
 *
 * Each rate has its own cap per transaction, so a large trade pays the cap
 * rather than the percentage.
 *
 * Deliberately *not* automatic: "registered in Belgium" is a property of
 * the fund's FSMA registration that no price provider exposes and that
 * this app therefore cannot know, and getting it wrong moves the rate by a
 * factor of four. `defaultTobCategory` guesses from the asset type only to
 * pre-select the most common case; the transaction form shows the
 * resulting rate and amount, and the user applies or overrides it. Nothing
 * here is ever written to a transaction without that confirmation.
 *
 * Rates and caps as published for 2025 — verify against FOD Financiën
 * before relying on them for a filing, and edit `TOB_RATES` here if they
 * change. This is an estimate for bookkeeping, not tax advice.
 */

export const TOB_CATEGORIES = [
  "SHARES",
  "BONDS",
  "FUND_FOREIGN",
  "FUND_BE_DISTRIBUTING",
  "FUND_BE_ACCUMULATING",
  "NONE",
] as const;

export type TobCategory = (typeof TOB_CATEGORIES)[number];

interface TobRate {
  /** Fraction of the gross transaction amount, e.g. 0.0035 for 0.35%. */
  rate: Decimal;
  /** Maximum tax per transaction, in EUR. Null for the "no TOB" case. */
  capPerTransaction: Decimal | null;
  label: string;
}

export const TOB_RATES: Record<TobCategory, TobRate> = {
  SHARES: {
    rate: new Decimal("0.0035"),
    capPerTransaction: new Decimal("1600"),
    label: "Shares (0.35%)",
  },
  BONDS: {
    rate: new Decimal("0.0012"),
    capPerTransaction: new Decimal("1300"),
    label: "Bonds (0.12%)",
  },
  FUND_FOREIGN: {
    rate: new Decimal("0.0035"),
    capPerTransaction: new Decimal("1600"),
    label: "Fund/ETF not registered in Belgium (0.35%)",
  },
  FUND_BE_DISTRIBUTING: {
    rate: new Decimal("0.0012"),
    capPerTransaction: new Decimal("1300"),
    label: "Belgian-registered fund, distributing (0.12%)",
  },
  FUND_BE_ACCUMULATING: {
    rate: new Decimal("0.0132"),
    capPerTransaction: new Decimal("4000"),
    label: "Belgian-registered fund, accumulating (1.32%)",
  },
  NONE: {
    rate: ZERO,
    capPerTransaction: null,
    label: "No TOB (crypto, cash, non-exchange)",
  },
};

export interface TobEstimate {
  /** The tax itself, rounded to cents (how it is actually charged). */
  amount: Decimal;
  rate: Decimal;
  /** True when the cap, not the rate, determined the amount — worth
   * surfacing, since the percentage then no longer explains the figure. */
  capped: boolean;
}

/**
 * Estimates the TOB on one transaction's gross amount (quantity x price,
 * before fees — fees are not part of the taxable base).
 *
 * `grossAmount` is expected in EUR: the tax is assessed in EUR and the
 * caps are EUR amounts, so a trade settled in another currency has to be
 * converted first. Callers that can't convert should present the result as
 * indicative — the same caveat `capitalGainsTaxService` already carries
 * for a non-EUR base currency.
 */
export function estimateBelgianTransactionTax(
  grossAmount: Decimal,
  category: TobCategory
): TobEstimate {
  const { rate, capPerTransaction } = TOB_RATES[category];

  // A negative gross amount is a data error, not a refund of tax — treat
  // the base as its magnitude rather than producing negative tax.
  const base = grossAmount.abs();
  const raw = base.times(rate);
  const capped = capPerTransaction !== null && raw.greaterThan(capPerTransaction);
  const amount = capPerTransaction !== null && capped ? capPerTransaction : raw;

  return { amount: amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP), rate, capped };
}

/**
 * The category to pre-select for a security, from the one property the app
 * does know. ETF/FUND maps to the foreign (0.35%) case because that is
 * what the common European trackers are; a Belgian-registered fund has to
 * be picked by hand, and is the reason the form keeps the selector visible
 * instead of hiding the whole thing behind the asset type.
 */
export function defaultTobCategory(assetType: AssetType): TobCategory {
  switch (assetType) {
    case "STOCK":
      return "SHARES";
    case "BOND":
      return "BONDS";
    case "ETF":
    case "FUND":
      return "FUND_FOREIGN";
    // Crypto is outside the TOB (no stock exchange involved), and CASH /
    // OTHER have no transaction tax of their own.
    case "CRYPTO":
    case "CASH":
    case "OTHER":
      return "NONE";
  }
}
