import type Decimal from "decimal.js";

/**
 * Domain types for the finance/portfolio/dividend calculation layer.
 *
 * These are intentionally decoupled from Prisma's generated types and from
 * API/UI DTOs. `lib/db/*` maps Prisma rows into these shapes; `lib/finance/*`
 * and the service layers (`lib/portfolio`, `lib/dividends`, `lib/performance`)
 * operate only on these types and never import Prisma directly.
 */

export type AssetType =
  | "STOCK"
  | "ETF"
  | "FUND"
  | "BOND"
  | "CASH"
  | "CRYPTO"
  | "OTHER";

export type TransactionType =
  | "BUY"
  | "SELL"
  | "DIVIDEND"
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "FEE"
  | "TAX"
  | "INTEREST"
  | "TRANSFER"
  | "SPLIT"
  | "OTHER";

/** ISO 4217 currency code, e.g. "EUR", "USD". */
export type CurrencyCode = string;

/**
 * A transaction as consumed by the finance layer. Mirrors the `Transaction`
 * table but with `Decimal` fields guaranteed non-null where the calculation
 * logic requires them, and dates as `Date`.
 */
export interface DomainTransaction {
  id: string;
  accountId: string;
  securityId: string | null;
  type: TransactionType;
  /** Transaction date (day precision). Used as the primary sort key. */
  date: Date;
  /** Secondary, deterministic tie-breaker for same-day transactions. */
  sequence: number;
  quantity: Decimal | null;
  price: Decimal | null;
  grossAmount: Decimal;
  fees: Decimal;
  taxes: Decimal;
  netAmount: Decimal;
  currency: CurrencyCode;
  /** Rate to convert `currency` -> account/portfolio base currency, if known. */
  exchangeRate: Decimal | null;
}

/** A single split/reverse-split corporate action applied to a security. */
export interface SplitEvent {
  securityId: string;
  effectiveDate: Date;
  /** e.g. 2 for a 2:1 split, 0.5 for a 1:2 reverse split. */
  ratio: Decimal;
}

export type CostBasisMethod = "AVERAGE_COST";

/** Realized gain/loss produced by a single SELL transaction. */
export interface RealizedGain {
  securityId: string;
  transactionId: string;
  date: Date;
  quantity: Decimal;
  /** Sale proceeds net of fees/taxes on the sale itself. */
  proceeds: Decimal;
  /** Cost basis of the shares sold, per the active accounting method. */
  costBasisRemoved: Decimal;
  realizedPnL: Decimal;
  currency: CurrencyCode;
  /**
   * Base-currency equivalents, converted using *this transaction's own*
   * historical FX rate (never today's rate — see costBasis.ts) — null when
   * no fxContext was supplied to `computeAverageCostLedger`, or when no FX
   * rate could be resolved for this transaction's date.
   */
  proceedsBase: Decimal | null;
  costBasisRemovedBase: Decimal | null;
  realizedPnLBase: Decimal | null;
}

/** Point-in-time cost-basis ledger state for one security. */
export interface CostBasisLedgerResult {
  securityId: string;
  quantity: Decimal;
  costBasis: Decimal;
  /** costBasis / quantity, or null when quantity is zero (avoid div/0). */
  averageCost: Decimal | null;
  /**
   * Cost basis converted to the portfolio base currency using each
   * transaction's own historical FX rate. Null when no fxContext was passed,
   * or once any transaction's FX rate couldn't be resolved (a missing rate
   * "poisons" this running total rather than silently treating it as 0/1 —
   * see costBasis.ts).
   */
  costBasisBase: Decimal | null;
  averageCostBase: Decimal | null;
  realizedGains: RealizedGain[];
}

export interface CurrentPrice {
  securityId: string;
  price: Decimal;
  currency: CurrencyCode;
  asOf: Date;
}

/** `rate` = units of `quoteCurrency` per 1 unit of `baseCurrency` on `date`. */
export interface FxRate {
  baseCurrency: CurrencyCode;
  quoteCurrency: CurrencyCode;
  date: Date;
  rate: Decimal;
}

/** A derived, current holding in a security. */
export interface Holding {
  securityId: string;
  ticker: string;
  name: string;
  assetType: AssetType;
  sector: string | null;
  country: string | null;
  currency: CurrencyCode;
  quantity: Decimal;
  averageCost: Decimal;
  costBasis: Decimal;
  /** Market value in the security's own currency, null if no price available. */
  marketValue: Decimal | null;
  unrealizedPnL: Decimal | null;
  unrealizedPnLPercent: Decimal | null;
  /** True when `marketValue` was computed from a price older than requested. */
  priceStale: boolean;
  /** True when a value in the portfolio base currency could not be computed. */
  missingFx: boolean;
  /** Values converted to the portfolio base currency, when computable. */
  baseCurrency: CurrencyCode;
  marketValueBase: Decimal | null;
  costBasisBase: Decimal | null;
  unrealizedPnLBase: Decimal | null;
}

export interface AllocationBucket {
  key: string;
  label: string;
  valueBase: Decimal;
  weight: Decimal;
}

export type AllocationDimension =
  | "security"
  | "assetType"
  | "sector"
  | "country"
  | "currency";

export interface DividendCashflow {
  securityId: string;
  transactionId: string;
  date: Date;
  grossAmount: Decimal;
  taxes: Decimal;
  netAmount: Decimal;
  currency: CurrencyCode;
  /** `netAmount` converted to the portfolio base currency using this
   * transaction's own historical FX rate — null if unresolvable. Same
   * "never use today's rate for a past cash flow" rule as cost basis. */
  netAmountBase: Decimal | null;
}

export interface DividendYieldResult {
  securityId: string;
  /** Trailing-12-month net dividends / current market value. */
  currentYield: Decimal | null;
  /** Trailing-12-month net dividends / cost basis. */
  yieldOnCost: Decimal | null;
}

export interface DividendGrowthResult {
  securityId: string;
  /** Net dividend income by calendar year, ascending. */
  incomeByYear: Array<{ year: number; income: Decimal }>;
  /** Year-over-year growth rates, null where a prior full year is missing. */
  yoyGrowth: Array<{ year: number; growth: Decimal | null }>;
  /** CAGR over the available full-year history, null if fewer than 2 full years. */
  cagr: Decimal | null;
}

/**
 * A cash flow from the investor's perspective, for XIRR (money-weighted
 * return). Negative = money invested (cash leaving the investor, e.g. a
 * deposit used to buy securities). Positive = money returned (a withdrawal,
 * or the final portfolio value as of the as-of date, treated as a terminal
 * inflow). This is the same sign convention as Excel's XIRR function.
 */
export interface ExternalCashflow {
  date: Date;
  amount: Decimal;
}
