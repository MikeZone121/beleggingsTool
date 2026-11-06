import { listSecurities } from "@/lib/db/securities";
import { getEarliestTransactionDateForSecurity } from "@/lib/db/transactions";
import { upsertSplit } from "@/lib/db/corporateActions";
import {
  getFinancialDataProvider,
  ProviderError,
  type SplitCapableProvider,
} from "@/lib/providers/financialData";

export interface CorporateActionSyncSummary {
  provider: string;
  /** Securities for which at least one split was written. */
  updated: number;
  failed: number;
  skipped: number;
  /** Splits written across every security — the number that actually
   * changes the ledger, which `updated` (a per-security count, matching
   * the other sync summaries) doesn't convey on its own. */
  splitsWritten: number;
  errors: Array<{ ticker: string; message: string }>;
}

function isSplitCapable(provider: object): provider is SplitCapableProvider {
  return typeof (provider as Partial<SplitCapableProvider>).getSplits === "function";
}

/** Whether the configured provider can report splits at all — the
 * Securities page hides the "Sync from provider" button rather than
 * offering a button that can only ever report "0 found". */
export function providerSupportsSplits(): boolean {
  return isSplitCapable(getFinancialDataProvider());
}

/**
 * Populates the `CorporateAction` table from the configured provider, so a
 * share split actually reaches the cost-basis ledger (see
 * `loadSplitsBySecurity`). Until this existed the table was written by
 * nothing: after a 10-for-1 split, the app kept showing the pre-split
 * quantity at the post-split price — a position looking 90% "down" with no
 * loss having happened.
 *
 * Two deliberate restrictions on what gets written:
 *
 *  - Splits dated **before** the security's earliest transaction are
 *    skipped. They can't change a position nobody held yet, and writing
 *    them would fill the review list with a decade of irrelevant history.
 *  - A security with **no** transactions at all (watchlist-only) is
 *    skipped entirely, for the same reason.
 *
 * What it can't decide for the user: some brokers *restate* older
 * transactions to post-split quantities in their exports. For an imported
 * history like that the split is already baked into the quantity, and
 * applying it again doubles it. That's why every synced split is listed and
 * individually deletable on the Securities page rather than applied
 * invisibly.
 *
 * With `manual` or `twelvedata` (no split endpoint on the free plan) this
 * is a no-op, same shape as `syncDividendHistory`.
 */
export async function syncCorporateActions(): Promise<CorporateActionSyncSummary> {
  const provider = getFinancialDataProvider();
  const summary: CorporateActionSyncSummary = {
    provider: provider.name,
    updated: 0,
    failed: 0,
    skipped: 0,
    splitsWritten: 0,
    errors: [],
  };

  if (!isSplitCapable(provider)) {
    const securities = await listSecurities();
    summary.skipped = securities.length;
    return summary;
  }

  for (const security of await listSecurities()) {
    try {
      const earliest = await getEarliestTransactionDateForSecurity(security.id);
      if (earliest === null) {
        summary.skipped += 1;
        continue;
      }

      const splits = (await provider.getSplits(security.ticker, security.exchange)).filter(
        (split) => split.effectiveDate.getTime() >= earliest.getTime()
      );
      if (splits.length === 0) {
        summary.skipped += 1;
        continue;
      }

      for (const split of splits) {
        await upsertSplit({
          securityId: security.id,
          effectiveDate: split.effectiveDate,
          ratio: split.ratio,
          source: provider.name,
        });
        summary.splitsWritten += 1;
      }
      summary.updated += 1;
    } catch (error) {
      summary.failed += 1;
      summary.errors.push({
        ticker: security.ticker,
        message:
          error instanceof ProviderError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Unknown error",
      });
    }
  }

  return summary;
}
