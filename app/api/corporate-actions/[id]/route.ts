import { requireApiUser } from "@/lib/auth/session";
import { deleteCorporateAction } from "@/lib/db/corporateActions";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Removes a split from the ledger. The one case that makes this essential:
 * a broker export that already restated old transactions to post-split
 * quantities, where a synced split would double-apply (see
 * `syncCorporateActions`).
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await requireApiUser();
    const { id } = await params;
    await deleteCorporateAction(id);
    return apiSuccess({ id });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
