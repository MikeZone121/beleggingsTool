import { requireApiUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { refreshAllMarketData } from "@/lib/portfolio/refreshAllService";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function POST() {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("NOT_FOUND", "No default portfolio found", 404);
    }

    const summary = await refreshAllMarketData(user.id, portfolio.id);
    return apiSuccess(summary);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
