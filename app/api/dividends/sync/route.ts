import { requireApiUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { syncDividendHistory } from "@/lib/portfolio/dividendSyncService";
import { createDividendTransactionsFromHistory } from "@/lib/portfolio/dividendTransactionService";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function POST() {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("NOT_FOUND", "No default portfolio found", 404);
    }

    const syncSummary = await syncDividendHistory();
    // Runs every time this endpoint does, not just the first time: any
    // dividend whose ex-date has since passed shows up as a normal
    // historical row on the next sync, and this immediately turns it into
    // a real transaction — that's what makes the whole pipeline
    // "automatic" rather than a one-off backfill.
    const transactionSummary = await createDividendTransactionsFromHistory(user.id, portfolio.id);

    return apiSuccess({ ...syncSummary, transactions: transactionSummary });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
