import { prisma } from "./client";

export async function listAccounts(userId: string, portfolioId: string) {
  return prisma.account.findMany({
    where: { portfolio: { id: portfolioId, userId } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getAccountById(userId: string, accountId: string) {
  return prisma.account.findFirst({
    where: { id: accountId, portfolio: { userId } },
  });
}

export async function createAccount(
  userId: string,
  data: {
    portfolioId: string;
    name: string;
    brokerName?: string | null;
    accountNumberMasked?: string | null;
    currency: string;
  }
) {
  // Scope check: the portfolio must belong to this user before we attach
  // an account to it.
  const portfolio = await prisma.portfolio.findFirst({
    where: { id: data.portfolioId, userId },
    select: { id: true },
  });
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  return prisma.account.create({ data });
}
