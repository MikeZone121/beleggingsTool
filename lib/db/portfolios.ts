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

/** Every portfolio, across every user — intentionally unscoped, unlike
 * every other query in this file: the scheduled dividend-sync job (see
 * `app/api/cron/sync-dividends/route.ts`) has no single user's session to
 * scope to, since it runs for everyone. */
export async function listAllPortfolios() {
  return prisma.portfolio.findMany({ select: { id: true, userId: true } });
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

/**
 * Updates the settings exposed on the Settings page. Scoped with
 * `updateMany` on `{ id, userId }` rather than `update` on `{ id }` — the
 * same pattern as `lib/db/watchlist.ts` — so someone else's portfolio id
 * matches zero rows instead of being written to.
 *
 * `accountingMethod` is deliberately not updatable: switching cost-basis
 * method retroactively rewrites every realized gain already reported (see
 * lib/finance/costBasis.ts), so it stays read-only rather than silently
 * changing history.
 */
export async function updatePortfolioSettings(
  userId: string,
  portfolioId: string,
  data: {
    name: string;
    baseCurrency: string;
    benchmarkTicker: string | null;
    dividendTaxRate: string;
  }
) {
  const result = await prisma.portfolio.updateMany({
    where: { id: portfolioId, userId },
    data: {
      name: data.name,
      baseCurrency: data.baseCurrency,
      benchmarkTicker: data.benchmarkTicker,
      dividendTaxRate: data.dividendTaxRate,
    },
  });
  if (result.count === 0) {
    throw new Error("Portfolio not found");
  }
  return getPortfolioById(userId, portfolioId);
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
