import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { removeFromWatchlist, setWatchlistTargetPrice, setWatchlistNotes } from "@/lib/db/watchlist";
import { positiveDecimalString } from "@/lib/validation/decimal";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const patchSchema = z
  .object({
    targetPrice: positiveDecimalString.nullable().optional(),
    notes: z.string().trim().max(500).nullable().optional(),
  })
  .refine((data) => data.targetPrice !== undefined || data.notes !== undefined, {
    message: "Provide targetPrice and/or notes",
  });

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await request.json();
    const { targetPrice, notes } = patchSchema.parse(body);

    if (targetPrice !== undefined) {
      const result = await setWatchlistTargetPrice(user.id, id, targetPrice);
      if (result.count === 0) return apiError("NOT_FOUND", "Watchlist item not found", 404);
    }
    if (notes !== undefined) {
      const result = await setWatchlistNotes(user.id, id, notes || null);
      if (result.count === 0) return apiError("NOT_FOUND", "Watchlist item not found", 404);
    }

    return apiSuccess({ targetPrice, notes });
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
