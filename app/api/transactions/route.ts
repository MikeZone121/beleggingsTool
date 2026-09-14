import { requireApiUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import {
  createPortfolioTransaction,
  listPortfolioTransactions,
} from "@/lib/portfolio/transactionService";
import { transactionInputSchema } from "@/lib/validation/transaction";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function GET() {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("NOT_FOUND", "No portfolio found for this user", 404);
    }
    const transactions = await listPortfolioTransactions(user.id, portfolio.id);
    return apiSuccess(transactions);
  } catch (error) {
    return apiErrorFromException(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const input = transactionInputSchema.parse(body);
    const transaction = await createPortfolioTransaction(user.id, input);
    return apiSuccess(transaction, { status: 201 });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
