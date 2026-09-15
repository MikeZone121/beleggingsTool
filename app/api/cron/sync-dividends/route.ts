import { listAllPortfolios } from "@/lib/db/portfolios";
import { syncDividendHistory } from "@/lib/portfolio/dividendSyncService";
import { createDividendTransactionsFromHistory } from "@/lib/portfolio/dividendTransactionService";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

/**
 * The scheduled counterpart to clicking "Sync Dividend History" — see
 * `vercel.json` for the cron schedule. There's no logged-in user here (a
 * cron trigger isn't a session), so this runs for every portfolio, not
 * one: syncs the shared `Dividend` table once, then turns any newly-
 * confirmed payout into a real transaction for whichever portfolio
 * actually held the shares, exactly like the button does per-user.
 *
 * Guarded by `CRON_SECRET` rather than `requireApiUser` — Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET` automatically when that env
 * var is set (see https://vercel.com/docs/cron-jobs/manage-cron-jobs).
 * Unset in an environment (e.g. local dev), and this refuses every
 * request rather than running unauthenticated.
 */
export async function GET(request: Request) {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      return apiError("NOT_CONFIGURED", "CRON_SECRET is not set", 503);
    }
    if (request.headers.get("authorization") !== `Bearer ${secret}`) {
      return apiError("UNAUTHORIZED", "Authentication required", 401);
    }

    const syncSummary = await syncDividendHistory();

    const portfolios = await listAllPortfolios();
    let transactionsCreated = 0;
    let transactionsFailed = 0;
    for (const portfolio of portfolios) {
      const result = await createDividendTransactionsFromHistory(portfolio.userId, portfolio.id);
      transactionsCreated += result.created;
      transactionsFailed += result.failed;
    }

    return apiSuccess({
      ...syncSummary,
      portfoliosProcessed: portfolios.length,
      transactionsCreated,
      transactionsFailed,
    });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
