import { requireApiUser } from "@/lib/auth/session";
import { createSecurity, listSecurities } from "@/lib/db/securities";
import { securityInputSchema } from "@/lib/validation/security";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function GET() {
  try {
    await requireApiUser();
    const securities = await listSecurities();
    return apiSuccess(securities);
  } catch (error) {
    return apiErrorFromException(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const body = await request.json();
    const input = securityInputSchema.parse(body);
    const security = await createSecurity(input);
    return apiSuccess(security, { status: 201 });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
