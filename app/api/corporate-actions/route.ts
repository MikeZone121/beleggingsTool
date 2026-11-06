import Decimal from "decimal.js";
import { requireApiUser } from "@/lib/auth/session";
import { listAllCorporateActions, upsertSplit } from "@/lib/db/corporateActions";
import { splitInputSchema } from "@/lib/validation/corporateAction";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function GET() {
  try {
    await requireApiUser();
    return apiSuccess(await listAllCorporateActions());
  } catch (error) {
    return apiErrorFromException(error);
  }
}

/**
 * Records a split by hand — for a provider that doesn't report splits, and
 * for the gap Yahoo's ten-year window leaves. `upsertSplit` is keyed on
 * (security, date), so re-submitting the same split corrects it instead of
 * adding a duplicate that would apply twice.
 */
export async function POST(request: Request) {
  try {
    await requireApiUser();
    const body = await request.json();
    const input = splitInputSchema.parse(body);
    const action = await upsertSplit({
      securityId: input.securityId,
      effectiveDate: input.effectiveDate,
      ratio: new Decimal(input.ratio),
      source: "manual",
    });
    return apiSuccess(action, { status: 201 });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
