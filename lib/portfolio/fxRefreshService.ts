import { listSecurities } from "@/lib/db/securities";
import { listDistinctBaseCurrencies } from "@/lib/db/portfolios";
import { upsertExchangeRate } from "@/lib/db/exchangeRates";
import { getFinancialDataProvider, ProviderError } from "@/lib/providers/financialData";

export interface FxRefreshSummary {
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ pair: string; message: string }>;
}

/**
 * Refreshes the `ExchangeRate` table for every currency pair a portfolio
 * actually needs: each held security's currency against its portfolio's
 * base currency. Nothing else in the app writes to this table outside of
 * `prisma/seed.ts` — without this, holdings priced in a foreign currency
 * silently lose their base-currency market value the moment the seeded
 * rates age out (see `deriveHoldings`'s `missingFx` handling), which reads
 * as "my cash went negative" rather than "an FX rate is missing" once
 * enough foreign-currency holdings are excluded from the portfolio total.
 *
 * Uses the same `FinancialDataProvider.getQuote` every security-price
 * refresh already calls, just with a currency-pair ticker (Yahoo's
 * `USDEUR=X` convention: quote's `price` is how many units of the second
 * currency one unit of the first is worth) — no separate provider method
 * needed. With the default `manual` provider this is a no-op, same as
 * `refreshAllPrices`.
 */
export async function refreshExchangeRates(): Promise<FxRefreshSummary> {
  const provider = getFinancialDataProvider();
  const [securities, baseCurrencies] = await Promise.all([
    listSecurities(),
    listDistinctBaseCurrencies(),
  ]);

  const pairs = new Set<string>();
  for (const base of baseCurrencies) {
    for (const security of securities) {
      if (security.currency !== base) {
        pairs.add(`${security.currency}:${base}`);
      }
    }
  }

  // Truncated to midnight so this always reads as "on or before" a price
  // quote fetched later today (see `deriveHoldings`'s `fxDate`), regardless
  // of exactly when within today's refresh run each request lands.
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  let updated = 0;
  let failed = 0;
  let skipped = 0;
  const errors: Array<{ pair: string; message: string }> = [];

  for (const pair of pairs) {
    const [from, to] = pair.split(":");
    try {
      const quote = await provider.getQuote(`${from}${to}=X`);
      if (!quote) {
        skipped += 1;
        continue;
      }
      await upsertExchangeRate({
        baseCurrency: from,
        quoteCurrency: to,
        date: today,
        rate: quote.price.toString(),
        source: provider.name,
      });
      updated += 1;
    } catch (error) {
      failed += 1;
      errors.push({
        pair,
        message:
          error instanceof ProviderError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unknown error",
      });
    }
  }

  return { updated, failed, skipped, errors };
}
