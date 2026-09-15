import { listSecurities } from "@/lib/db/securities";
import { listDistinctBaseCurrencies } from "@/lib/db/portfolios";
import {
  listDistinctTransactionCurrencies,
  getEarliestTransactionDate,
} from "@/lib/db/transactions";
import { upsertExchangeRate, getEarliestExchangeRateDate } from "@/lib/db/exchangeRates";
import { getFinancialDataProvider, ProviderError } from "@/lib/providers/financialData";

export interface FxRefreshSummary {
  updated: number;
  failed: number;
  skipped: number;
  errors: Array<{ pair: string; message: string }>;
}

function errorMessage(error: unknown): string {
  if (error instanceof ProviderError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

/**
 * Refreshes the `ExchangeRate` table for every currency pair the app
 * actually needs: each held security's currency, and each transaction's own
 * currency (a DEPOSIT/WITHDRAWAL/etc. can be foreign-denominated with no
 * security involved), against every portfolio's base currency. Nothing else
 * in the app writes to this table outside of `prisma/seed.ts`.
 *
 * Two distinct gaps this closes, both silent otherwise:
 *  - **Current valuation**: `deriveHoldings` needs a rate dated on/before
 *    *today* to price a foreign-currency holding — missing that drops the
 *    holding's `marketValueBase` entirely (shows as "—", excluded from the
 *    portfolio total). Fixed by writing today's rate for every pair.
 *  - **Historical cash accounting**: `calculateCashBalance` needs a rate
 *    dated on/before *each transaction's own date* — a rate for today does
 *    NOT satisfy that (`findFxRate` only accepts rates on/before the target
 *    date), so a foreign-currency BUY/SELL/etc. with no rate covering its
 *    date gets silently excluded from the cash sum (`hasMissingFx`), rather
 *    than being converted. This reads as "my cash balance is wrong" with no
 *    indication why — the only visible clue is the "Incomplete — missing FX
 *    rate" sublabel on the Cash Balance/other KPI tiles. Fixed once per pair
 *    by backfilling the whole daily rate history back to that pair's
 *    earliest-needed transaction date, via the same `getHistoricalPrices`
 *    security price refreshes already use (Yahoo's `USDEUR=X` convention:
 *    one unit of the first currency is worth `price` units of the second).
 *    Cheap after the first run — `getEarliestExchangeRateDate` skips the
 *    backfill once a pair's history already reaches far enough back.
 *
 * With the default `manual` provider this is a no-op, same as
 * `refreshAllPrices`.
 */
export async function refreshExchangeRates(): Promise<FxRefreshSummary> {
  const provider = getFinancialDataProvider();
  const [securities, baseCurrencies, transactionCurrencies] = await Promise.all([
    listSecurities(),
    listDistinctBaseCurrencies(),
    listDistinctTransactionCurrencies(),
  ]);

  const currencies = new Set([
    ...securities.map((s) => s.currency),
    ...transactionCurrencies,
  ]);
  const pairs = new Set<string>();
  for (const base of baseCurrencies) {
    for (const currency of currencies) {
      if (currency !== base) pairs.add(`${currency}:${base}`);
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
    const ticker = `${from}${to}=X`;

    const backfill = await backfillHistory(provider, from, to, ticker, today);
    updated += backfill.updated;
    if (backfill.failed) {
      failed += 1;
      errors.push({ pair, message: backfill.message ?? "Historical backfill failed" });
    }

    try {
      const quote = await provider.getQuote(ticker);
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
      errors.push({ pair, message: errorMessage(error) });
    }
  }

  return { updated, failed, skipped, errors };
}

async function backfillHistory(
  provider: ReturnType<typeof getFinancialDataProvider>,
  from: string,
  to: string,
  ticker: string,
  today: Date
): Promise<{ updated: number; failed: boolean; message?: string }> {
  const [earliestNeeded, earliestOnRecord] = await Promise.all([
    getEarliestTransactionDate(from),
    getEarliestExchangeRateDate(from, to),
  ]);
  // Nothing has ever transacted in this currency, or this pair's rate
  // history already reaches back far enough — no backfill needed.
  if (!earliestNeeded || (earliestOnRecord && earliestOnRecord <= earliestNeeded)) {
    return { updated: 0, failed: false };
  }

  try {
    const points = await provider.getHistoricalPrices(ticker, earliestNeeded, today);
    for (const point of points) {
      await upsertExchangeRate({
        baseCurrency: from,
        quoteCurrency: to,
        date: point.date,
        rate: point.close.toString(),
        source: provider.name,
      });
    }
    return { updated: points.length, failed: false };
  } catch (error) {
    return { updated: 0, failed: true, message: errorMessage(error) };
  }
}
