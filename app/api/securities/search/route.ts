import { requireApiUser } from "@/lib/auth/session";
import { getFinancialDataProvider } from "@/lib/providers/financialData";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function GET(request: Request) {
  try {
    await requireApiUser();
    const query = new URL(request.url).searchParams.get("q")?.trim();
    if (!query) {
      return apiError("VALIDATION_ERROR", "Query parameter 'q' is required", 400);
    }

    const provider = getFinancialDataProvider();
    const results = await provider.searchSecurities(query);
    return apiSuccess(results);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
