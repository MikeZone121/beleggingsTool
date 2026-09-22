import { requireApiUser } from "@/lib/auth/session";
import { refreshWatchlistMarketData } from "@/lib/portfolio/watchlistRefreshService";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function POST() {
  try {
    const user = await requireApiUser();
    const summary = await refreshWatchlistMarketData(user.id);
    return apiSuccess(summary);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
