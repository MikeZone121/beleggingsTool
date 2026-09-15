import { requireApiUser } from "@/lib/auth/session";
import { syncPriceHistory } from "@/lib/portfolio/priceHistorySyncService";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function POST() {
  try {
    await requireApiUser();
    const summary = await syncPriceHistory();
    return apiSuccess(summary);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
