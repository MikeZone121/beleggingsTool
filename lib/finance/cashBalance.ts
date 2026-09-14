import Decimal from "decimal.js";
import type { DomainTransaction, TransactionType } from "@/types/domain";
import type { FxContext } from "./costBasis";
import { findFxRate } from "./currency";
import { ZERO } from "./money";

/**
 * Cash-impact sign for each transaction type, from the account's own
 * perspective (not the investor's — contrast with `ExternalCashflow` in
 * returns.ts). `netAmount` is always a non-negative magnitude (see
 * computeTransactionAmounts); this table says which direction it moves
 * the account's cash balance.
 *
 * TRANSFER and OTHER are deliberately excluded: the schema doesn't capture
 * a transfer's direction, so guessing a sign would silently misstate cash —
 * see `hasExcludedTransactions` below instead.
 */
const CASH_IMPACT_SIGN: Partial<Record<TransactionType, 1 | -1>> = {
  DEPOSIT: 1,
  WITHDRAWAL: -1,
  BUY: -1,
  SELL: 1,
  DIVIDEND: 1,
  INTEREST: 1,
  FEE: -1,
  TAX: -1,
};

export interface CashBalanceResult {
  /** Best-effort total; transactions with unresolvable FX are excluded from
   * the sum (not treated as 0) but flagged via `hasMissingFx`. */
  balanceBase: Decimal;
  hasMissingFx: boolean;
  /** True if any TRANSFER/OTHER transaction exists — these never affect
   * `balanceBase`, so a portfolio using them will under/overstate cash. */
  hasExcludedTransactions: boolean;
}

/** Derives an account's cash balance from DEPOSIT/WITHDRAWAL/BUY/SELL/
 * DIVIDEND/INTEREST/FEE/TAX transactions, converted to the base currency via
 * each transaction's own historical FX rate. */
export function calculateCashBalance(
  transactions: DomainTransaction[],
  fxContext: FxContext
): CashBalanceResult {
  let balanceBase = ZERO;
  let hasMissingFx = false;
  let hasExcludedTransactions = false;

  for (const tx of transactions) {
    const sign = CASH_IMPACT_SIGN[tx.type];
    if (sign === undefined) {
      if (tx.type === "TRANSFER" || tx.type === "OTHER") hasExcludedTransactions = true;
      continue;
    }

    const rate =
      tx.currency === fxContext.baseCurrency
        ? new Decimal(1)
        : (tx.exchangeRate ?? findFxRate(fxContext.fxRates, tx.currency, fxContext.baseCurrency, tx.date));

    if (rate === null) {
      hasMissingFx = true;
      continue;
    }

    balanceBase = balanceBase.plus(tx.netAmount.times(rate).times(sign));
  }

  return { balanceBase, hasMissingFx, hasExcludedTransactions };
}
