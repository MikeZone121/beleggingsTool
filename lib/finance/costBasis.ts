import Decimal from "decimal.js";
import type {
  DomainTransaction,
  SplitEvent,
  CostBasisLedgerResult,
  RealizedGain,
  CurrencyCode,
  FxRate,
} from "@/types/domain";
import { ZERO } from "./money";
import { findFxRate } from "./currency";

/**
 * Average-cost accounting engine (MVP accounting method — see Phase 0 plan
 * section 4 and 9 for why average cost was chosen over FIFO, and how a
 * `FIFOCostBasisLedger` could be added later behind the same call shape).
 *
 * Conventions (documented because they are not self-evident from the code):
 *  - BUY:  cost added to the ledger = quantity * price + fees + taxes.
 *          Fees/taxes on a purchase increase cost basis.
 *  - SELL: proceeds = quantity * price - fees - taxes.
 *          Fees/taxes on a sale reduce proceeds (and therefore realized P&L).
 *          The cost basis removed is `averageCostBeforeSale * quantitySold`.
 *  - SPLIT / REVERSE_SPLIT: modeled as `SplitEvent`s (from `CorporateAction`
 *    rows), not as `Transaction` rows, even though `TransactionType.SPLIT`
 *    exists in the schema for completeness. A split multiplies quantity by
 *    `ratio` and leaves total cost basis unchanged (average cost per share
 *    is divided by `ratio` automatically). On a date where a split and a
 *    trade coincide, the split is applied first (splits take effect at
 *    market open, before same-day trades).
 *  - All other transaction types (DIVIDEND, DEPOSIT, WITHDRAWAL, FEE, TAX,
 *    INTEREST, TRANSFER, OTHER) do not affect a security's cost-basis ledger.
 *  - Selling more shares than currently held throws — this is either a data
 *    error or a missing prior transaction, and must never be silently
 *    "fixed" by clamping to zero.
 *
 * Base-currency tracking: when `fxContext` is supplied, a second running
 * total (`costBasisBase`, and `*Base` fields on each `RealizedGain`) is kept
 * alongside the native-currency ledger, converting every BUY/SELL using
 * *that transaction's own* historical rate — `tx.exchangeRate` if present,
 * else the nearest-prior-date rate from `fxContext.fxRates`. This is
 * deliberately NOT the same as converting the final aggregate cost basis
 * using today's rate (a common mistake): today's rate belongs on *market
 * value*, never on cost basis, or currency translation gains/losses get
 * silently baked into the reported investment return. Once any transaction's
 * rate can't be resolved, `costBasisBase` (and every subsequent `*Base`
 * field) becomes `null` for the rest of the ledger — a missing rate must
 * never be silently treated as 0 or 1.
 *
 * Fiscal step-up: pass `stepUp` to re-base the position held on a given
 * date to a fixed price per share, leaving quantity untouched. This is not
 * an accounting event — it exists for the Belgian capital-gains regime,
 * where a pre-2026 position's *taxable* acquisition value is its
 * 31/12/2025 market value rather than what was actually paid (see
 * lib/finance/capitalGainsTax.ts). Run the ledger twice — once without and
 * once with `stepUp` — to get the accounting gain and the taxable gain for
 * the same sale.
 */

export interface FxContext {
  baseCurrency: CurrencyCode;
  fxRates: FxRate[];
}

/** Re-bases whatever is held on `effectiveDate` to `pricePerShare`, before
 * any trade or split booked that day. `pricePerShareBase` is the same price
 * in the portfolio base currency (null when it can't be resolved, which
 * poisons `costBasisBase` from that point on, exactly like a missing
 * transaction rate). */
export interface FiscalStepUp {
  effectiveDate: Date;
  pricePerShare: Decimal;
  pricePerShareBase: Decimal | null;
}

type LedgerEvent =
  | { kind: "BUY" | "SELL"; date: Date; order: number; tx: DomainTransaction }
  | { kind: "SPLIT"; date: Date; order: number; ratio: Decimal }
  | {
      kind: "STEP_UP";
      date: Date;
      order: number;
      pricePerShare: Decimal;
      pricePerShareBase: Decimal | null;
    };

/** A trade's `order` is its `sequence` (a positive epoch-ms timestamp), so
 * both sentinels below sort before any same-day trade. They are ordered
 * relative to each other too: a step-up price is quoted in the shares as
 * they traded *before* a split on the same date, so it must be applied
 * first or the re-based cost would be off by the split ratio. */
const STEP_UP_ORDER = Number.NEGATIVE_INFINITY;
const SPLIT_ORDER = Number.MIN_SAFE_INTEGER;

function buildLedgerEvents(
  transactions: DomainTransaction[],
  splits: SplitEvent[],
  stepUp?: FiscalStepUp
): LedgerEvent[] {
  const events: LedgerEvent[] = [];

  for (const tx of transactions) {
    if (tx.type === "BUY" || tx.type === "SELL") {
      events.push({ kind: tx.type, date: tx.date, order: tx.sequence, tx });
    }
  }
  for (const split of splits) {
    events.push({
      kind: "SPLIT",
      date: split.effectiveDate,
      order: SPLIT_ORDER,
      ratio: split.ratio,
    });
  }
  if (stepUp) {
    events.push({
      kind: "STEP_UP",
      date: stepUp.effectiveDate,
      order: STEP_UP_ORDER,
      pricePerShare: stepUp.pricePerShare,
      pricePerShareBase: stepUp.pricePerShareBase,
    });
  }

  return events.sort((a, b) => {
    const dateDiff = a.date.getTime() - b.date.getTime();
    if (dateDiff !== 0) return dateDiff;
    return a.order - b.order;
  });
}

/** Resolves the rate to convert `tx.currency` -> base currency for `tx`,
 * preferring the transaction's own recorded rate over a historical lookup. */
function resolveTxRate(tx: DomainTransaction, fxContext: FxContext): Decimal | null {
  if (tx.currency === fxContext.baseCurrency) return new Decimal(1);
  if (tx.exchangeRate !== null) return tx.exchangeRate;
  return findFxRate(fxContext.fxRates, tx.currency, fxContext.baseCurrency, tx.date);
}

export function computeAverageCostLedger(
  securityId: string,
  transactions: DomainTransaction[],
  splits: SplitEvent[] = [],
  fxContext?: FxContext,
  stepUp?: FiscalStepUp
): CostBasisLedgerResult {
  let quantity = ZERO;
  let costBasis = ZERO;
  let costBasisBase: Decimal | null = fxContext ? ZERO : null;
  const realizedGains: RealizedGain[] = [];

  const events = buildLedgerEvents(transactions, splits, stepUp);

  for (const event of events) {
    if (event.kind === "SPLIT") {
      quantity = quantity.times(event.ratio);
      // costBasis (native and base) is unchanged by a split.
      continue;
    }

    if (event.kind === "STEP_UP") {
      // Nothing held on that date means nothing to re-base — and in
      // particular not a cost basis of zero, which would make the whole
      // proceeds of a later sale taxable.
      if (quantity.isPositive()) {
        costBasis = quantity.times(event.pricePerShare);
        if (fxContext) {
          costBasisBase =
            event.pricePerShareBase !== null
              ? quantity.times(event.pricePerShareBase)
              : null;
        }
      }
      continue;
    }

    const { tx } = event;

    if (tx.quantity === null || tx.price === null) {
      throw new Error(
        `${tx.type} transaction ${tx.id} for security ${securityId} is missing quantity or price`
      );
    }

    const rate = fxContext ? resolveTxRate(tx, fxContext) : null;

    if (event.kind === "BUY") {
      const costAdded = tx.quantity
        .times(tx.price)
        .plus(tx.fees)
        .plus(tx.taxes);
      quantity = quantity.plus(tx.quantity);
      costBasis = costBasis.plus(costAdded);
      if (fxContext) {
        costBasisBase =
          costBasisBase !== null && rate !== null
            ? costBasisBase.plus(costAdded.times(rate))
            : null;
      }
      continue;
    }

    // SELL
    if (tx.quantity.greaterThan(quantity)) {
      throw new Error(
        `Cannot sell ${tx.quantity.toString()} shares of security ${securityId} on ` +
          `${tx.date.toISOString().slice(0, 10)}: only ${quantity.toString()} held. ` +
          `Check for a missing prior BUY or an out-of-order transaction date.`
      );
    }

    const averageCostBeforeSale = quantity.isZero()
      ? ZERO
      : costBasis.dividedBy(quantity);
    const costBasisRemoved = averageCostBeforeSale.times(tx.quantity);
    const proceeds = tx.quantity.times(tx.price).minus(tx.fees).minus(tx.taxes);
    const realizedPnL = proceeds.minus(costBasisRemoved);

    let costBasisRemovedBase: Decimal | null = null;
    let proceedsBase: Decimal | null = null;
    let realizedPnLBase: Decimal | null = null;
    if (fxContext) {
      const averageCostBaseBeforeSale =
        costBasisBase !== null && !quantity.isZero()
          ? costBasisBase.dividedBy(quantity)
          : quantity.isZero()
            ? ZERO
            : null;
      costBasisRemovedBase =
        averageCostBaseBeforeSale !== null
          ? averageCostBaseBeforeSale.times(tx.quantity)
          : null;
      proceedsBase = rate !== null ? proceeds.times(rate) : null;
      realizedPnLBase =
        proceedsBase !== null && costBasisRemovedBase !== null
          ? proceedsBase.minus(costBasisRemovedBase)
          : null;
      costBasisBase =
        costBasisBase !== null && costBasisRemovedBase !== null
          ? costBasisBase.minus(costBasisRemovedBase)
          : null;
    }

    quantity = quantity.minus(tx.quantity);
    costBasis = costBasis.minus(costBasisRemoved);

    realizedGains.push({
      securityId,
      transactionId: tx.id,
      date: tx.date,
      quantity: tx.quantity,
      proceeds,
      costBasisRemoved,
      realizedPnL,
      currency: tx.currency,
      proceedsBase,
      costBasisRemovedBase,
      realizedPnLBase,
    });
  }

  return {
    securityId,
    quantity,
    costBasis,
    averageCost: quantity.isZero() ? null : costBasis.dividedBy(quantity),
    costBasisBase,
    averageCostBase:
      costBasisBase !== null && !quantity.isZero()
        ? costBasisBase.dividedBy(quantity)
        : null,
    realizedGains,
  };
}
