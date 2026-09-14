import { z } from "zod";
import { requireApiUser } from "@/lib/auth/session";
import { getAccountById } from "@/lib/db/accounts";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { listSecurities } from "@/lib/db/securities";
import { parseCsv, validateImportRow } from "@/lib/importers/generic/csvParser";
import type { ColumnMapping } from "@/lib/importers/types";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

const previewSchema = z.object({
  csvText: z.string().min(1),
  mapping: z.record(z.string(), z.string()),
  accountId: z.string().min(1),
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = await request.json();
    const { csvText, mapping, accountId } = previewSchema.parse(body);

    const account = await getAccountById(user.id, accountId);
    if (!account) {
      return apiError("NOT_FOUND", "Account not found", 404);
    }
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("NOT_FOUND", "No portfolio found", 404);
    }

    const { rows } = parseCsv(csvText);
    const securities = await listSecurities();
    const securityByTicker = new Map(
      securities.map((s) => [s.ticker.toUpperCase(), { id: s.id, ticker: s.ticker, currency: s.currency }])
    );

    const results = rows.map((row, i) =>
      validateImportRow(
        i + 2, // +1 for 1-indexing, +1 for the header row
        row,
        mapping as ColumnMapping,
        accountId,
        portfolio.baseCurrency,
        securityByTicker
      )
    );

    return apiSuccess({ results });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
