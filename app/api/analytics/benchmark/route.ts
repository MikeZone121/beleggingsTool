import { requireApiUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getBenchmarkComparison } from "@/lib/performance/benchmarkService";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("NOT_FOUND", "No default portfolio found", 404);
    }

    const ticker = new URL(request.url).searchParams.get("ticker")?.trim().toUpperCase();
    if (!ticker) {
      return apiError("VALIDATION_ERROR", "Query parameter 'ticker' is required", 400);
    }

    const comparison = await getBenchmarkComparison(user.id, portfolio.id, ticker);
    return apiSuccess(comparison);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
