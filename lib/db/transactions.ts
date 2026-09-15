import { prisma } from "./client";
import type { TransactionInput } from "@/lib/validation/transaction";

/** Every distinct transaction currency across every portfolio — a
 * DEPOSIT/WITHDRAWAL/FEE/etc. can be denominated in a foreign currency
 * directly, with no security involved, so this covers pairs that scanning
 * `Security.currency` alone would miss. Unscoped by user, like
 * `listSecurities` — feeds the background FX-rate refresh/backfill. */
export async function listDistinctTransactionCurrencies(): Promise<string[]> {
  const rows = await prisma.transaction.findMany({
    distinct: ["currency"],
    select: { currency: true },
  });
  return rows.map((r) => r.currency);
}

/** Earliest transaction date referencing a given security, across every
 * portfolio — unscoped by user, like `listSecurities`. Feeds the
 * historical price backfill (see `lib/portfolio/priceHistorySyncService.ts`),
 * which needs to know how far back a security's daily price history must
 * reach to cover its own first transaction. */
export async function getEarliestTransactionDateForSecurity(securityId: string): Promise<Date | null> {
  const row = await prisma.transaction.findFirst({
    where: { securityId },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return row?.date ?? null;
}

/** Earliest transaction date recorded in a given currency, across every
 * portfolio — like `listSecurities`, intentionally unscoped by user: it
 * feeds the background FX-rate backfill (see
 * `lib/portfolio/fxRefreshService.ts`), which needs to know how far back a
 * currency pair's rate history must reach to cover every existing
 * transaction, not just one user's. */
export async function getEarliestTransactionDate(currency: string): Promise<Date | null> {
  const row = await prisma.transaction.findFirst({
    where: { currency },
    orderBy: { date: "asc" },
    select: { date: true },
  });
  return row?.date ?? null;
}

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
