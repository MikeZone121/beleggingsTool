import { prisma } from "./client";
import type { TransactionInput } from "@/lib/validation/transaction";

/** All transactions for every account in a user's portfolio. */
export async function listTransactionsForPortfolio(userId: string, portfolioId: string) {
  return prisma.transaction.findMany({
    where: { account: { portfolio: { id: portfolioId, userId } } },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    include: { security: true },
  });
}

export async function getTransactionById(userId: string, transactionId: string) {
  return prisma.transaction.findFirst({
    where: { id: transactionId, account: { portfolio: { userId } } },
    include: { security: true },
  });
}

interface CreateTransactionParams {
  userId: string;
  input: TransactionInput;
  grossAmount: string;
  netAmount: string;
}

export async function createTransaction({
  userId,
  input,
  grossAmount,
  netAmount,
}: CreateTransactionParams) {
  const account = await prisma.account.findFirst({
    where: { id: input.accountId, portfolio: { userId } },
    select: { id: true },
  });
  if (!account) {
    throw new Error("Account not found");
  }

  return prisma.transaction.create({
    data: {
      accountId: input.accountId,
      securityId: input.securityId,
      type: input.type,
      date: input.date,
      quantity: input.quantity,
      price: input.price,
      grossAmount,
      fees: input.fees,
      taxes: input.taxes,
      netAmount,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      notes: input.notes ?? null,
      externalId: input.externalId ?? null,
    },
  });
}

export async function updateTransaction(
  userId: string,
  transactionId: string,
  params: { input: TransactionInput; grossAmount: string; netAmount: string }
) {
  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, account: { portfolio: { userId } } },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Transaction not found");
  }

  const { input, grossAmount, netAmount } = params;
  return prisma.transaction.update({
    where: { id: transactionId },
    data: {
      accountId: input.accountId,
      securityId: input.securityId,
      type: input.type,
      date: input.date,
      quantity: input.quantity,
      price: input.price,
      grossAmount,
      fees: input.fees,
      taxes: input.taxes,
      netAmount,
      currency: input.currency,
      exchangeRate: input.exchangeRate,
      notes: input.notes ?? null,
      externalId: input.externalId ?? null,
    },
  });
}

export async function deleteTransaction(userId: string, transactionId: string) {
  const existing = await prisma.transaction.findFirst({
    where: { id: transactionId, account: { portfolio: { userId } } },
    select: { id: true },
  });
  if (!existing) {
    throw new Error("Transaction not found");
  }
  return prisma.transaction.delete({ where: { id: transactionId } });
}
