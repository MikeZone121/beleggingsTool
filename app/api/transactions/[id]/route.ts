import { requireApiUser } from "@/lib/auth/session";
import {
  deletePortfolioTransaction,
  getPortfolioTransaction,
  updatePortfolioTransaction,
} from "@/lib/portfolio/transactionService";
import { transactionUpdateSchema } from "@/lib/validation/transaction";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const transaction = await getPortfolioTransaction(user.id, id);
    if (!transaction) {
      return apiError("NOT_FOUND", "Transaction not found", 404);
    }
    return apiSuccess(transaction);
  } catch (error) {
    return apiErrorFromException(error);
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    const body = await request.json();
    const input = transactionUpdateSchema.parse(body);
    const transaction = await updatePortfolioTransaction(user.id, id, input);
    return apiSuccess(transaction);
  } catch (error) {
    return apiErrorFromException(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const user = await requireApiUser();
    const { id } = await params;
    await deletePortfolioTransaction(user.id, id);
    return apiSuccess({ id });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
