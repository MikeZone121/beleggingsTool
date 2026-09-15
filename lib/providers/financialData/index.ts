import type { FinancialDataProvider } from "./types";
import { ManualProvider } from "./manualProvider";
import { TwelveDataProvider } from "./twelveData";
import { YahooFinanceProvider } from "./yahooFinance";

export type { FinancialDataProvider, ProviderQuote, ProviderPricePoint, ProviderDividendEvent, ProviderSecurityMatch } from "./types";
export { ProviderError } from "./types";

let cached: FinancialDataProvider | null = null;

/** Env-driven factory — application code depends only on the
 * `FinancialDataProvider` interface, never on a specific vendor. */
export function getFinancialDataProvider(): FinancialDataProvider {
  if (cached) return cached;

  const providerName = process.env.FINANCIAL_DATA_PROVIDER ?? "manual";

  if (providerName === "twelvedata") {
    const apiKey = process.env.FINANCIAL_DATA_API_KEY;
    if (!apiKey) {
      throw new Error(
        "FINANCIAL_DATA_PROVIDER=twelvedata requires FINANCIAL_DATA_API_KEY to be set"
      );
    }
    cached = new TwelveDataProvider(apiKey);
    return cached;
  }

  if (providerName === "yahoo") {
    cached = new YahooFinanceProvider();
    return cached;
  }

  cached = new ManualProvider();
  return cached;
}
