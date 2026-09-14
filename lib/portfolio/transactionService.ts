import Decimal from "decimal.js";
import type { TransactionInput } from "@/lib/validation/transaction";
import { computeTransactionAmounts } from "@/lib/finance/transactionAmounts";
import {
  createTransaction as createTransactionRow,
  updateTransaction as updateTransactionRow,
  deleteTransaction as deleteTransactionRow,
  listTransactionsForPortfolio,
  getTransactionById,
} from "@/lib/db/transactions";

function toDecimalOrNull(value: string | null): Decimal | null {
  return value === null ? null : new Decimal(value);
}

/**
 * `TransactionInput.amount` (used for non-trade types) has no column of its
 * own on `Transaction` — it's exactly `grossAmount` before fees/taxes are
 * applied, so it's derived rather than stored separately.
 */
function deriveAmounts(input: TransactionInput) {
  return computeTransactionAmounts({
    type: input.type,
    quantity: toDecimalOrNull(input.quantity),
    price: toDecimalOrNull(input.price),
    amount: toDecimalOrNull(input.amount),
    fees: new Decimal(input.fees),
    taxes: new Decimal(input.taxes),
  });
}

export async function createPortfolioTransaction(userId: string, input: TransactionInput) {
  const { grossAmount, netAmount } = deriveAmounts(input);
  return createTransactionRow({
    userId,
    input,
    grossAmount: grossAmount.toString(),
    netAmount: netAmount.toString(),
  });
}

export async function updatePortfolioTransaction(
  userId: string,
  transactionId: string,
  input: TransactionInput
) {
  const { grossAmount, netAmount } = deriveAmounts(input);
  return updateTransactionRow(userId, transactionId, {
    input,
    grossAmount: grossAmount.toString(),
    netAmount: netAmount.toString(),
  });
}

export async function deletePortfolioTransaction(userId: string, transactionId: string) {
  return deleteTransactionRow(userId, transactionId);
}

export async function listPortfolioTransactions(userId: string, portfolioId: string) {
  return listTransactionsForPortfolio(userId, portfolioId);
}

export async function getPortfolioTransaction(userId: string, transactionId: string) {
  return getTransactionById(userId, transactionId);
}
