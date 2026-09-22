import type {
  DomainTransaction,
  SplitEvent,
  CurrentPrice,
  FxRate,
  Holding,
  AssetType,
  CurrencyCode,
} from "@/types/domain";
import { computeAverageCostLedger, type FxContext } from "./costBasis";
import { convertToBase } from "./currency";
import { ratioOf, ZERO } from "./money";
import { isPriceStale } from "./priceChange";

export interface SecurityMeta {
  id: string;
  ticker: string;
  name: string;
  assetType: AssetType;
  sector: string | null;
  country: string | null;
  currency: CurrencyCode;
}

function groupBySecurity(
  transactions: DomainTransaction[]
): Map<string, DomainTransaction[]> {
  const groups = new Map<string, DomainTransaction[]>();
  for (const tx of transactions) {
    if (tx.securityId === null) continue;
    const list = groups.get(tx.securityId) ?? [];
    list.push(tx);
    groups.set(tx.securityId, list);
  }
  return groups;
}

/**
 * Derives current holdings (quantity > 0) from a portfolio's transaction
 * history. This is the single entry point that replays BUY/SELL/SPLIT
 * events per security via `computeAverageCostLedger` — nothing else in the
 * app is allowed to re-derive quantity/cost-basis independently.
 *
 * Securities that have been fully sold (quantity === 0) are excluded from
 * the result; their history still contributes to `RealizedGain`s, which are
 * available by calling `computeAverageCostLedger` directly for reporting.
 */
export function deriveHoldings(
  transactions: DomainTransaction[],
  securities: SecurityMeta[],
  currentPrices: Map<string, CurrentPrice>,
  fxRates: FxRate[],
  baseCurrency: CurrencyCode,
  splitsBySecurity: Map<string, SplitEvent[]> = new Map()
): Holding[] {
  const securityById = new Map(securities.map((s) => [s.id, s]));
  const grouped = groupBySecurity(transactions);
  const holdings: Holding[] = [];

  for (const [securityId, txs] of grouped) {
    const security = securityById.get(securityId);
    if (!security) {
      throw new Error(
        `Transaction references unknown security ${securityId}; securities must be loaded before deriving holdings.`
      );
    }

    const splits = splitsBySecurity.get(securityId) ?? [];
    const fxContext: FxContext = { baseCurrency, fxRates };
    const ledger = computeAverageCostLedger(securityId, txs, splits, fxContext);

    if (ledger.quantity.isZero()) continue;

    const currentPrice = currentPrices.get(securityId);
    const priceAsOf = currentPrice?.asOf ?? null;
    const now = new Date();
    // No price at all counts as stale here (unlike the Watchlist, which
    // shows "no price" in its own right) — a holding with no price has no
    // market value, and that must not read as up to date.
    const priceStale = priceAsOf ? isPriceStale(priceAsOf) : true;

    const marketValue = currentPrice
      ? ledger.quantity.times(currentPrice.price)
      : null;
    const unrealizedPnL = marketValue
      ? marketValue.minus(ledger.costBasis)
      : null;
    const unrealizedPnLPercent = unrealizedPnL
      ? ratioOf(unrealizedPnL, ledger.costBasis)
      : null;

    // Market value uses TODAY's rate (it's a live, current-moment figure);
    // cost basis uses each transaction's own historical rate, already
    // computed by the ledger above — never re-convert an aggregate cost
    // basis with today's rate, or currency moves get misreported as
    // investment return (see costBasis.ts).
    const fxDate = currentPrice?.asOf ?? now;
    const marketValueBase = marketValue
      ? convertToBase(marketValue, security.currency, baseCurrency, fxDate, fxRates)
      : null;
    const costBasisBase = ledger.costBasisBase;
    const unrealizedPnLBase =
      marketValueBase !== null && costBasisBase !== null
        ? marketValueBase.minus(costBasisBase)
        : null;

    holdings.push({
      securityId,
      ticker: security.ticker,
      name: security.name,
      assetType: security.assetType,
      sector: security.sector,
      country: security.country,
      currency: security.currency,
      quantity: ledger.quantity,
      averageCost: ledger.averageCost ?? ZERO,
      costBasis: ledger.costBasis,
      marketValue,
      unrealizedPnL,
      unrealizedPnLPercent,
      priceStale,
      missingFx: marketValueBase === null || costBasisBase === null,
      baseCurrency,
      marketValueBase,
      costBasisBase,
      unrealizedPnLBase,
    });
  }

  return holdings;
}
