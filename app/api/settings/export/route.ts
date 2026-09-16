import { requireApiUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { listAccounts } from "@/lib/db/accounts";
import { listTransactionsForPortfolio } from "@/lib/db/transactions";
import { listSecurities } from "@/lib/db/securities";
import { listWatchlist } from "@/lib/db/watchlist";
import { listAllAllocationTargets } from "@/lib/db/allocationTargets";
import { apiError, apiErrorFromException } from "@/lib/utils/apiResponse";

/**
 * A full, human-readable JSON dump of everything the user entered —
 * portfolio settings, accounts, transactions, watchlist and allocation
 * targets — so their records aren't trapped in this app.
 *
 * Deliberately excludes market data (prices, FX rates, synced dividend
 * history): all of it is re-fetchable from the provider and would bloat the
 * file by orders of magnitude without holding anything the user typed. The
 * securities included are only the reference rows the transactions point
 * at, so a transaction's ticker is resolvable from the file alone.
 *
 * Decimal columns are serialized as strings, never numbers: JSON numbers
 * are IEEE-754 doubles, which would quietly round exactly the values this
 * app is careful never to round.
 */
export async function GET() {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("REQUEST_ERROR", "No portfolio found", 404);
    }

    const [accounts, transactions, securities, watchlist, allocationTargets] = await Promise.all([
      listAccounts(user.id, portfolio.id),
      listTransactionsForPortfolio(user.id, portfolio.id),
      listSecurities(),
      listWatchlist(user.id),
      listAllAllocationTargets(portfolio.id),
    ]);

    const referencedSecurityIds = new Set(
      transactions.map((tx) => tx.securityId).filter((id): id is string => id !== null)
    );
    for (const item of watchlist) {
      referencedSecurityIds.add(item.securityId);
    }

    const payload = {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      portfolio: {
        name: portfolio.name,
        baseCurrency: portfolio.baseCurrency,
        accountingMethod: portfolio.accountingMethod,
        benchmarkTicker: portfolio.benchmarkTicker,
        dividendTaxRate: portfolio.dividendTaxRate.toString(),
      },
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        brokerName: account.brokerName,
        currency: account.currency,
      })),
      securities: securities
        .filter((security) => referencedSecurityIds.has(security.id))
        .map((security) => ({
          id: security.id,
          ticker: security.ticker,
          name: security.name,
          isin: security.isin,
          assetType: security.assetType,
          exchange: security.exchange,
          currency: security.currency,
          sector: security.sector,
        })),
      transactions: transactions.map((tx) => ({
        id: tx.id,
        accountId: tx.accountId,
        securityId: tx.securityId,
        type: tx.type,
        date: tx.date.toISOString().slice(0, 10),
        quantity: tx.quantity?.toString() ?? null,
        price: tx.price?.toString() ?? null,
        grossAmount: tx.grossAmount.toString(),
        fees: tx.fees.toString(),
        taxes: tx.taxes.toString(),
        netAmount: tx.netAmount.toString(),
        currency: tx.currency,
        exchangeRate: tx.exchangeRate?.toString() ?? null,
        notes: tx.notes,
      })),
      watchlist: watchlist.map((item) => ({
        securityId: item.securityId,
        ticker: item.security.ticker,
        notes: item.notes,
        targetPrice: item.targetPrice?.toString() ?? null,
      })),
      allocationTargets: allocationTargets.map((target) => ({
        dimension: target.dimension,
        key: target.key,
        targetPercent: target.targetPercent.toString(),
      })),
    };

    const filename = `canopy-export-${new Date().toISOString().slice(0, 10)}.json`;
    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
