import { requireUser } from "@/lib/auth/session";
import { listSecurities } from "@/lib/db/securities";
import { getWatchlistSnapshot } from "@/lib/portfolio/watchlistService";
import { WatchlistTable } from "@/components/watchlist/watchlist-table";
import { AddWatchlistDialog } from "@/components/watchlist/add-watchlist-dialog";
import { RefreshWatchlistButton } from "@/components/watchlist/refresh-watchlist-button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Percent } from "@/components/ui/money";
import { formatRelativeTime } from "@/lib/utils/format";
import { getUserLocale } from "@/lib/utils/serverLocale";

export default async function WatchlistPage() {
  const user = await requireUser();

  const [items, securities, locale] = await Promise.all([
    getWatchlistSnapshot(user.id),
    listSecurities(),
    getUserLocale(),
  ]);

  const securityOptions = securities.map((s) => ({
    id: s.id,
    ticker: s.ticker,
    name: s.name,
    currency: s.currency,
  }));
  const watchedSecurityIds = new Set(items.map((i) => i.securityId));

  // The oldest quote on the page, not the newest: "prices updated 2 minutes
  // ago" would be a lie if one ticker in the table hadn't moved in a week.
  const oldestPriceAsOf = items
    .map((i) => i.priceAsOf)
    .filter((asOf): asOf is string => asOf !== null)
    .sort()
    .at(0);

  const targetsReached = items.filter((i) => i.targetReached).length;
  const biggestMover = items
    .filter((i) => i.dayChangePercent !== null)
    .sort((a, b) => Math.abs(Number(b.dayChangePercent)) - Math.abs(Number(a.dayChangePercent)))
    .at(0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Watchlist</h1>
          <p className="text-sm text-muted-foreground">
            Securities you&apos;re tracking without owning — {items.length} ticker
            {items.length === 1 ? "" : "s"}
            {oldestPriceAsOf && (
              <> · prices updated {formatRelativeTime(oldestPriceAsOf, { locale })}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <RefreshWatchlistButton disabled={items.length === 0} />
          <AddWatchlistDialog existingSecurities={securityOptions} watchedSecurityIds={watchedSecurityIds} />
        </div>
      </div>

      {items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard label="Watching" value={items.length} />
          <KpiCard
            label="At Target"
            value={targetsReached}
            sublabel={targetsReached > 0 ? "Price at or below your target" : "No targets reached yet"}
            tone={targetsReached > 0 ? "positive" : "neutral"}
            highlight={targetsReached > 0}
          />
          <KpiCard
            label="Biggest Mover Today"
            value={biggestMover ? biggestMover.ticker : "—"}
            sublabel={
              biggestMover ? (
                <Percent value={biggestMover.dayChangePercent!} signDisplay="always" />
              ) : (
                "No price data yet"
              )
            }
            tone={
              biggestMover
                ? Number(biggestMover.dayChangePercent) >= 0
                  ? "positive"
                  : "negative"
                : undefined
            }
          />
        </div>
      )}

      <WatchlistTable items={items} />
    </div>
  );
}
