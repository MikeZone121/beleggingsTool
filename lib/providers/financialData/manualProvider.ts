import type {
  FinancialDataProvider,
  ProviderQuote,
  ProviderPricePoint,
  ProviderDividendEvent,
  ProviderSecurityMatch,
} from "./types";

/**
 * The default provider (`FINANCIAL_DATA_PROVIDER=manual` or unset): every
 * method returns "no data" rather than throwing, so the rest of the app
 * (manual price entry, the `EditPricePopover`, etc.) keeps working exactly
 * as it did before Phase 7 when no API key is configured.
 */
export class ManualProvider implements FinancialDataProvider {
  readonly name = "manual";

  async searchSecurities(): Promise<ProviderSecurityMatch[]> {
    return [];
  }

  async getQuote(): Promise<ProviderQuote | null> {
    return null;
  }

  async getHistoricalPrices(): Promise<ProviderPricePoint[]> {
    return [];
  }

  async getDividends(): Promise<ProviderDividendEvent[]> {
    return [];
  }
}
