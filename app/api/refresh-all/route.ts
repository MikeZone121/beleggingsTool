import { requireApiUser } from "@/lib/auth/session";
import { refreshAllMarketData } from "@/lib/portfolio/refreshAllService";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function POST() {
  try {
    await requireApiUser();
    const summary = await refreshAllMarketData();
    return apiSuccess(summary);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
