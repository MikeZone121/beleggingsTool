import { requireApiUser } from "@/lib/auth/session";
import { getDefaultPortfolio, updatePortfolioSettings } from "@/lib/db/portfolios";
import { refreshExchangeRates } from "@/lib/portfolio/fxRefreshService";
import { portfolioSettingsSchema } from "@/lib/validation/settings";
import { apiError, apiErrorFromException, apiSuccess } from "@/lib/utils/apiResponse";

export async function PATCH(request: Request) {
  try {
    const user = await requireApiUser();
    const portfolio = await getDefaultPortfolio(user.id);
    if (!portfolio) {
      return apiError("REQUEST_ERROR", "No portfolio found", 404);
    }

    const input = portfolioSettingsSchema.parse(await request.json());
    const baseCurrencyChanged = input.baseCurrency !== portfolio.baseCurrency;

    const updated = await updatePortfolioSettings(user.id, portfolio.id, input);

    // Every base-currency figure in the app is converted through the
    // `ExchangeRate` table, and that table only holds the pairs the old
    // base currency needed (see fxRefreshService). Without this, switching
    // base currency leaves holdings priced in any other currency showing
    // "Incomplete — missing FX rate" until the user happens to run Refresh
    // All. Not fatal if it fails — the rates are recoverable from that
    // button — so it's reported, not thrown.
    let fxRefreshError: string | null = null;
    if (baseCurrencyChanged) {
      try {
        await refreshExchangeRates();
      } catch (error) {
        fxRefreshError = error instanceof Error ? error.message : "Unknown error";
      }
    }

    return apiSuccess({
      name: updated?.name,
      baseCurrency: updated?.baseCurrency,
      benchmarkTicker: updated?.benchmarkTicker,
      dividendTaxRate: updated?.dividendTaxRate.toString(),
      baseCurrencyChanged,
      fxRefreshError,
    });
  } catch (error) {
    return apiErrorFromException(error);
  }
}
