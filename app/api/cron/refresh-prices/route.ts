import { refreshAllMarketData } from "@/lib/portfolio/refreshAllService";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

/**
 * The scheduled counterpart to the dashboard's "Refresh all" button — see
 * `vercel.json` for the schedule. Until this existed, every price in the
 * app was only ever as fresh as the last time someone opened it and
 * clicked: a portfolio left alone for a week showed week-old values, and
 * the day-change colouring and benchmark chart silently froze with it
 * (only dividends had a cron).
 *
 * Runs `refreshAllMarketData` — current prices, FX rates and historical
 * closes — for every security in the database, not per user: securities
 * and prices are shared reference data, so there is nothing user-scoped
 * to iterate here (unlike the dividend cron, which also has to write
 * per-portfolio transactions).
 *
 * Guarded by `CRON_SECRET` exactly like `/api/cron/sync-dividends`: Vercel
 * Cron sends `Authorization: Bearer $CRON_SECRET` automatically when that
 * env var is set. Unset, this refuses every request rather than exposing
 * an unauthenticated endpoint that burns the provider's rate limit.
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

    return apiSuccess(await refreshAllMarketData());
  } catch (error) {
    return apiErrorFromException(error);
  }
}
