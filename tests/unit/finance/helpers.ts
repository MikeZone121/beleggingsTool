import Decimal from "decimal.js";
import type { DomainTransaction, TransactionType } from "@/types/domain";

let idCounter = 0;
let sequenceCounter = 0;

function nextId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

interface TxInput {
  securityId?: string | null;
  type: TransactionType;
  date: string;
  quantity?: number;
  price?: number;
  fees?: number;
  taxes?: number;
  currency?: string;
  accountId?: string;
}

/**
 * Builds a `DomainTransaction` with sensible defaults so tests only spell
 * out the fields that matter for the scenario being tested.
 * `grossAmount`/`netAmount` are derived the same way the app's validation
 * layer would (grossAmount = quantity * price for trades), but the
 * cost-basis engine itself never reads them — only quantity/price/fees/taxes.
 */
export function tx(input: TxInput): DomainTransaction {
  sequenceCounter += 1;
  const quantity = input.quantity !== undefined ? new Decimal(input.quantity) : null;
  const price = input.price !== undefined ? new Decimal(input.price) : null;
  const fees = new Decimal(input.fees ?? 0);
  const taxes = new Decimal(input.taxes ?? 0);
  const grossAmount = quantity && price ? quantity.times(price) : new Decimal(0);

  return {
    id: nextId("tx"),
    accountId: input.accountId ?? "acc-1",
    securityId: input.securityId === undefined ? "sec-1" : input.securityId,
    type: input.type,
    date: new Date(input.date),
    sequence: sequenceCounter,
    quantity,
    price,
    grossAmount,
    fees,
    taxes,
    netAmount: grossAmount,
    currency: input.currency ?? "EUR",
    exchangeRate: null,
  };
}

export function resetSequence() {
  sequenceCounter = 0;
}

export function d(value: number | string): Decimal {
  return new Decimal(value);
}
