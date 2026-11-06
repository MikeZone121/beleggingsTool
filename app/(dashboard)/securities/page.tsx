import Decimal from "decimal.js";
import { requireUser } from "@/lib/auth/session";
import { countTransactionsBySecurity, listSecurities } from "@/lib/db/securities";
import { listAllCorporateActions } from "@/lib/db/corporateActions";
import { providerSupportsSplits } from "@/lib/portfolio/corporateActionSyncService";
import { EmptyState } from "@/components/empty-state";
import { AddSecurityDialog } from "@/components/securities/add-security-dialog";
import { SecuritiesTable, type SecurityRow } from "@/components/securities/securities-table";
import {
  CorporateActionsCard,
  type SplitRow,
} from "@/components/securities/corporate-actions-card";

/**
 * The reference-data counterpart to Portfolio (which shows only what you
 * currently hold): every security the app knows, including fully-sold and
 * watchlist-only ones, with the editing and deleting that used to require
 * database access. A wrong ticker is the common case — the providers key
 * price and dividend lookups off it.
 */
export default async function SecuritiesPage() {
  await requireUser();

  const [securities, transactionCounts, corporateActions] = await Promise.all([
    listSecurities(),
    countTransactionsBySecurity(),
    listAllCorporateActions(),
  ]);

  const rows: SecurityRow[] = securities.map((s) => ({
    id: s.id,
    ticker: s.ticker,
    name: s.name,
    assetType: s.assetType,
    exchange: s.exchange,
    currency: s.currency,
    isin: s.isin,
    country: s.country,
    sector: s.sector,
    currentPrice: s.currentPrice?.toString() ?? null,
    priceUpdatedAt: s.priceUpdatedAt?.toISOString() ?? null,
    transactionCount: transactionCounts.get(s.id) ?? 0,
  }));

  const splitRows: SplitRow[] = corporateActions.map((action) => {
    const details = action.details as { ratio?: string; source?: string } | null;
    const ratio = details?.ratio ?? "1";
    return {
      id: action.id,
      securityId: action.securityId,
      ticker: action.security.ticker,
      name: action.security.name,
      effectiveDate: action.effectiveDate.toISOString(),
      ratio,
      isReverse: isReverseRatio(ratio),
      source: details?.source ?? "manual",
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Securities</h1>
          <p className="text-sm text-muted-foreground">
            {rows.length} securit{rows.length === 1 ? "y" : "ies"} · tickers, exchanges and manual
            prices
          </p>
        </div>
        <AddSecurityDialog />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No securities yet"
          description="Add a security to record transactions against it, or import a CSV."
        />
      ) : (
        <SecuritiesTable securities={rows} />
      )}

      <CorporateActionsCard
        splits={splitRows}
        securities={securities.map((s) => ({ id: s.id, ticker: s.ticker, name: s.name }))}
        providerSupportsSync={providerSupportsSplits()}
      />
    </div>
  );
}

/** A stored ratio below 1 is a reverse split (see `upsertSplit`). Guarded
 * so a corrupt `details.ratio` renders as a normal split rather than
 * throwing the whole page. */
function isReverseRatio(ratio: string): boolean {
  try {
    return new Decimal(ratio).lessThan(1);
  } catch {
    return false;
  }
}
