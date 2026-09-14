import { z } from "zod";
import Decimal from "decimal.js";
import { requireApiUser } from "@/lib/auth/session";
import { updateSecurityPrice } from "@/lib/db/securities";
import { apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

const priceUpdateSchema = z.object({
  currentPrice: z
    .string()
    .trim()
    .min(1)
    .refine((val) => {
      try {
        return new Decimal(val).greaterThan(0);
      } catch {
        return false;
      }
    }, "Must be a positive number"),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await requireApiUser();
    const { id } = await params;
    const body = await request.json();
    const { currentPrice } = priceUpdateSchema.parse(body);
    const security = await updateSecurityPrice(id, currentPrice);
    return apiSuccess(security);
  } catch (error) {
    return apiErrorFromException(error);
  }
}
