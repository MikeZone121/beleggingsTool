import { requireApiUser } from "@/lib/auth/session";
import { refreshAllPrices } from "@/lib/portfolio/priceRefreshService";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function POST() {
  try {
    await requireApiUser();
    const summary = await refreshAllPrices();
    return apiSuccess(summary);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
