import { prisma } from "./client";

/**
 * All portfolio-scoped queries take `userId` explicitly and filter by it —
 * even though MVP has exactly one user, this is the boundary that keeps
 * cross-tenant leakage structurally impossible once real multi-user auth
 * is added (see lib/auth/session.ts).
 */
export async function getDefaultPortfolio(userId: string) {
  return prisma.portfolio.findFirst({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

export async function getPortfolioById(userId: string, portfolioId: string) {
  return prisma.portfolio.findFirst({
    where: { id: portfolioId, userId },
  });
}

/** Every distinct base currency in use across all portfolios — like
 * `listSecurities`, intentionally unscoped by user: it feeds the background
 * FX-rate refresh (see `lib/portfolio/fxRefreshService.ts`), which populates
 * a shared reference table, not user-specific data. */
export async function listDistinctBaseCurrencies(): Promise<string[]> {
  const rows = await prisma.portfolio.findMany({
    distinct: ["baseCurrency"],
    select: { baseCurrency: true },
  });
  return rows.map((r) => r.baseCurrency);
}

export async function createPortfolio(
  userId: string,
  data: { name: string; baseCurrency: string; isDefault?: boolean }
) {
  return prisma.portfolio.create({
    data: {
      userId,
      name: data.name,
      baseCurrency: data.baseCurrency,
      isDefault: data.isDefault ?? true,
    },
  });
}
