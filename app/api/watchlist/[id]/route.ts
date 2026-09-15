import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { removeFromWatchlist, setWatchlistTargetPrice } from "@/lib/db/watchlist";
import { positiveDecimalString } from "@/lib/validation/decimal";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  targetPrice: positiveDecimalString.nullable(),
});

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await request.json();
    const { targetPrice } = patchSchema.parse(body);
    const result = await setWatchlistTargetPrice(user.id, id, targetPrice);
    if (result.count === 0) {
      return apiError("NOT_FOUND", "Watchlist item not found", 404);
    }
    return apiSuccess({ targetPrice });
  } catch (error) {
    return apiErrorFromException(error);
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    await removeFromWatchlist(user.id, id);
    return apiSuccess({ deleted: true });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
