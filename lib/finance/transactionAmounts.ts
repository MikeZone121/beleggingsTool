import Decimal from "decimal.js";
import type { TransactionType } from "@/types/domain";
import { ZERO } from "./money";

export interface TransactionAmountInput {
  type: TransactionType;
  /** Required for BUY/SELL. */
  quantity: Decimal | null;
  /** Required for BUY/SELL. */
  price: Decimal | null;
  /** The user-entered cash amount for every non-trade type (DIVIDEND's
   * gross dividend, a DEPOSIT/WITHDRAWAL/FEE/TAX/INTEREST/TRANSFER/OTHER
   * amount). Ignored for BUY/SELL/SPLIT. */
  amount: Decimal | null;
  fees: Decimal;
  taxes: Decimal;
}

export interface TransactionAmounts {
  grossAmount: Decimal;
  netAmount: Decimal;
}

/**
 * Derives `grossAmount`/`netAmount` server-side from the fields a user
 * actually controls (quantity/price/amount/fees/taxes) — these are never
 * accepted directly from a client, so a form can't submit an inconsistent
 * gross/net pair.
 *
 * Conventions (all magnitudes are non-negative; `type` carries the cash
 * direction for downstream reporting):
 *  - BUY:  gross = quantity * price;  net = gross + fees + taxes (cash cost).
 *  - SELL: gross = quantity * price;  net = gross - fees - taxes (proceeds).
 *  - DIVIDEND: gross = amount (gross dividend); net = amount - taxes - fees.
 *  - DEPOSIT/WITHDRAWAL/INTEREST/TRANSFER/OTHER: gross = amount;
 *    net = amount - fees - taxes.
 *  - FEE/TAX: gross = net = amount (the fee/tax amount itself).
 *  - SPLIT: gross = net = 0 (purely informational; splits are applied via
 *    `CorporateAction` in the cost-basis engine, see lib/finance/costBasis.ts).
 */
export function computeTransactionAmounts(
  input: TransactionAmountInput
): TransactionAmounts {
  const { type, quantity, price, amount, fees, taxes } = input;

  switch (type) {
    case "BUY": {
      const qp = requireQuantityAndPrice(type, quantity, price);
      const gross = qp.quantity.times(qp.price);
      return { grossAmount: gross, netAmount: gross.plus(fees).plus(taxes) };
    }
    case "SELL": {
      const qp = requireQuantityAndPrice(type, quantity, price);
      const gross = qp.quantity.times(qp.price);
      return { grossAmount: gross, netAmount: gross.minus(fees).minus(taxes) };
    }
    case "DIVIDEND": {
      const gross = requireAmount(type, amount);
      return { grossAmount: gross, netAmount: gross.minus(taxes).minus(fees) };
    }
    case "DEPOSIT":
    case "WITHDRAWAL":
    case "INTEREST":
    case "TRANSFER":
    case "OTHER": {
      const gross = requireAmount(type, amount);
      return { grossAmount: gross, netAmount: gross.minus(fees).minus(taxes) };
    }
    case "FEE":
    case "TAX": {
      const gross = requireAmount(type, amount);
      return { grossAmount: gross, netAmount: gross };
    }
    case "SPLIT":
      return { grossAmount: ZERO, netAmount: ZERO };
  }
}

function requireQuantityAndPrice(
  type: TransactionType,
  quantity: Decimal | null,
  price: Decimal | null
): { quantity: Decimal; price: Decimal } {
  if (quantity === null || price === null) {
    throw new Error(`${type} requires both quantity and price`);
  }
  return { quantity, price };
}

function requireAmount(type: TransactionType, amount: Decimal | null): Decimal {
  if (amount === null) {
    throw new Error(`${type} requires an amount`);
  }
  return amount;
}
