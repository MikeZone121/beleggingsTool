import { requireApiUser } from "@/lib/auth/session";
import { deleteSecurity, updateSecurity } from "@/lib/db/securities";
import { securityUpdateSchema } from "@/lib/validation/security";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Partial update of a security. Accepts any subset of the create schema's
 * fields, so this serves both the Portfolio table's price pencil (which
 * sends `{ currentPrice }` alone) and the Securities page's edit dialog
 * (ticker, name, exchange, currency, …).
 */
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await requireApiUser();
    const { id } = await params;
    const body = await request.json();
    const input = securityUpdateSchema.parse(body);
    const security = await updateSecurity(id, input);
    return apiSuccess(security);
  } catch (error) {
    return apiErrorFromException(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    await requireApiUser();
    const { id } = await params;
    await deleteSecurity(id);
    return apiSuccess({ id });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
