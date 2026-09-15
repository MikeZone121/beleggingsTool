import { requireApiUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { deleteAllocationTarget } from "@/lib/db/allocationTargets";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("NOT_FOUND", "No default portfolio found", 404);
    }

    const { id } = await params;
    await deleteAllocationTarget(id, portfolio.id);
    return apiSuccess({ id });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
