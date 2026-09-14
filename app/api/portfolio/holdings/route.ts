import { requireApiUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function GET() {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("NOT_FOUND", "No portfolio found for this user", 404);
    }
    const snapshot = await getPortfolioSnapshot(user.id, portfolio.id);
    return apiSuccess(snapshot);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
