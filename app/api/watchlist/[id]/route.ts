import { requireApiUser } from "@/lib/auth/session";
import { removeFromWatchlist } from "@/lib/db/watchlist";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

interface RouteParams {
  params: Promise<{ id: string }>;
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
