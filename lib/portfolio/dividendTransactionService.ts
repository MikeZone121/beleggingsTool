import Decimal from "decimal.js";
import { Prisma } from "@/generated/prisma/client";
import { listTransactionsForPortfolio } from "@/lib/db/transactions";
import { getSecuritiesByIds } from "@/lib/db/securities";
import { getPortfolioById } from "@/lib/db/portfolios";
import { listDividendsForSecurities } from "@/lib/db/dividends";
import { toDomainTransaction, toSecurityMeta } from "@/lib/db/mappers";
import { deriveHoldings } from "@/lib/finance/holdings";
import { BELGIAN_DIVIDEND_WITHHOLDING_TAX_RATE } from "@/lib/finance/dividendCalendar";
import { createPortfolioTransaction } from "./transactionService";
import { transactionInputSchema } from "@/lib/validation/transaction";

export interface AutoDividendSummary {
  created: number;
  /** Already recorded on a previous run — the `externalId` unique
   * constraint caught it, so this is expected on every rerun, not a
   * problem. */
  skippedAlreadyRecorded: number;
  /** A real, paid dividend for a security the account didn't hold on
   * that ex-dividend date (bought later, or sold before). */
  skippedNotHeld: number;
  /** The same security was traded from more than one account within
   * this portfolio — which account actually held it on that date isn't
   * determinable from the data available here, so this is skipped
   * rather than guessed. */
  skippedAmbiguousAccount: number;
  failed: number;
  errors: Array<{ securityId: string; exDividendDate: string; message: string }>;
}

const ZERO_SUMMARY: AutoDividendSummary = {
  created: 0,
  skippedAlreadyRecorded: 0,
  skippedNotHeld: 0,
  skippedAmbiguousAccount: 0,
  failed: 0,
  errors: [],
};

/**
 * Turns confirmed, already-paid dividend history (the `Dividend` rows
 * `dividendSyncService.ts` populates from the market-data provider) into
 * real DIVIDEND transactions — automatically, for every ex-dividend date
 * where this portfolio actually held shares, without requiring the user to
 * enter each one by hand.
 *
 * Safe to call repeatedly (e.g. every time "Sync Dividend History" runs,
 * or from a scheduled job — see `app/api/cron/sync-dividends/route.ts`):
 * each created transaction's `externalId` is deterministic
 * (`yahoo-dividend:<Dividend.id>`), and the DB's
 * `@@unique([accountId, externalId])` constraint makes a rerun a no-op for
 * anything already recorded, caught here as `skippedAlreadyRecorded`
 * rather than surfaced as a failure.
 *
 * Tax is estimated at the flat Belgian withholding rate (see
 * `estimateBelgianDividendPayout`) and recorded in `taxes` — noted clearly
 * in each transaction's `notes` as an estimate, since the actual rate a
 * real broker applies can differ (foreign withholding already deducted
 * abroad, VVPRbis, etc.). The user can edit or delete any of these like
 * any other transaction if their broker statement says otherwise.
 */
export async function createDividendTransactionsFromHistory(
  userId: string,
  portfolioId: string
): Promise<AutoDividendSummary> {
  const portfolio = await getPortfolioById(userId, portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  const transactionRows = await listTransactionsForPortfolio(userId, portfolioId);
  const transactions = transactionRows.map(toDomainTransaction);

  const securityIds = Array.from(
    new Set(transactionRows.map((t) => t.securityId).filter((id): id is string => id !== null))
  );
  if (securityIds.length === 0) return ZERO_SUMMARY;

  const securityRows = await getSecuritiesByIds(securityIds);
  const securities = securityRows.map(toSecurityMeta);

  // Which single account (within this portfolio) holds transactions for
  // each security — a security traded from more than one account is
  // skipped as ambiguous rather than guessed (see `skippedAmbiguousAccount`).
  const accountsBySecurity = new Map<string, Set<string>>();
  for (const row of transactionRows) {
    if (!row.securityId) continue;
    const set = accountsBySecurity.get(row.securityId) ?? new Set<string>();
    set.add(row.accountId);
    accountsBySecurity.set(row.securityId, set);
  }

  const dividendRows = await listDividendsForSecurities(securityIds);

  const summary: AutoDividendSummary = { ...ZERO_SUMMARY, errors: [] };

  for (const dividend of dividendRows) {
    const accounts = accountsBySecurity.get(dividend.securityId);
    if (!accounts || accounts.size === 0) continue;
    if (accounts.size > 1) {
      summary.skippedAmbiguousAccount += 1;
      continue;
    }
    const accountId = [...accounts][0];

    const transactionsUpToDate = transactions.filter(
      (t) => t.accountId === accountId && t.date.getTime() <= dividend.exDividendDate.getTime()
    );
    const holdings = deriveHoldings(
      transactionsUpToDate,
      securities,
      new Map(),
      [],
      portfolio.baseCurrency
    );
    const quantity = holdings.find((h) => h.securityId === dividend.securityId)?.quantity ?? new Decimal(0);
    if (!quantity.greaterThan(0)) {
      summary.skippedNotHeld += 1;
      continue;
    }

    const dividendPerShare = new Decimal(dividend.dividendPerShare.toString());
    const grossAmount = dividendPerShare.times(quantity);
    const taxAmount = grossAmount.times(BELGIAN_DIVIDEND_WITHHOLDING_TAX_RATE);
    const externalId = `yahoo-dividend:${dividend.id}`;

    try {
      const input = transactionInputSchema.parse({
        accountId,
        securityId: dividend.securityId,
        type: "DIVIDEND",
        date: dividend.exDividendDate,
        quantity: null,
        price: null,
        amount: grossAmount.toString(),
        fees: "0",
        taxes: taxAmount.toString(),
        currency: dividend.currency,
        exchangeRate: null,
        notes: `Auto-added from ${dividend.source} dividend history (${quantity.toString()} shares @ ${dividendPerShare.toString()}/share). Tax estimated at ${BELGIAN_DIVIDEND_WITHHOLDING_TAX_RATE.times(100).toString()}% BE withholding — verify against your broker statement.`,
        externalId,
      });
      await createPortfolioTransaction(userId, input);
      summary.created += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        summary.skippedAlreadyRecorded += 1;
      } else {
        summary.failed += 1;
        summary.errors.push({
          securityId: dividend.securityId,
          exDividendDate: dividend.exDividendDate.toISOString().slice(0, 10),
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  return summary;
}
