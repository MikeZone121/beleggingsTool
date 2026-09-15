import { requireApiUser } from "@/lib/auth/session";
import { syncDividendHistory } from "@/lib/portfolio/dividendSyncService";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function POST() {
  try {
    await requireApiUser();
    const summary = await syncDividendHistory();
    return apiSuccess(summary);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
