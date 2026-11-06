import { requireApiUser } from "@/lib/auth/session";
import { syncCorporateActions } from "@/lib/portfolio/corporateActionSyncService";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function POST() {
  try {
    await requireApiUser();
    return apiSuccess(await syncCorporateActions());
  } catch (error) {
    return apiErrorFromException(error);
  }
}
