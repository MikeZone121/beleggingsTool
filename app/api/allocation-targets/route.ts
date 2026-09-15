import { requireApiUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { upsertAllocationTarget } from "@/lib/db/allocationTargets";
import { getRebalancingPlan } from "@/lib/portfolio/rebalancingService";
import { allocationTargetInputSchema, ALLOCATION_DIMENSIONS } from "@/lib/validation/allocationTarget";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

function isAllocationDimension(value: string | null): value is (typeof ALLOCATION_DIMENSIONS)[number] {
  return (ALLOCATION_DIMENSIONS as readonly string[]).includes(value ?? "");
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("NOT_FOUND", "No default portfolio found", 404);
    }

    const dimension = new URL(request.url).searchParams.get("dimension");
    if (!isAllocationDimension(dimension)) {
      return apiError(
        "VALIDATION_ERROR",
        `dimension must be one of: ${ALLOCATION_DIMENSIONS.join(", ")}`,
        400
      );
    }

    const plan = await getRebalancingPlan(user.id, portfolio.id, dimension);
    return apiSuccess(plan);
  } catch (error) {
    return apiErrorFromException(error);
  }
}

export async function PUT(request: Request) {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("NOT_FOUND", "No default portfolio found", 404);
    }

    const body = await request.json();
    const input = allocationTargetInputSchema.parse(body);
    const target = await upsertAllocationTarget({ portfolioId: portfolio.id, ...input });
    return apiSuccess(target);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
