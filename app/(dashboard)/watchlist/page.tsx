import { requireUser } from "@/lib/auth/session";
import { listSecurities } from "@/lib/db/securities";
import { getWatchlistSnapshot } from "@/lib/portfolio/watchlistService";
import { WatchlistTable } from "@/components/watchlist/watchlist-table";
import { AddWatchlistDialog } from "@/components/watchlist/add-watchlist-dialog";

export default async function WatchlistPage() {
  const user = await requireUser();

  const [items, securities] = await Promise.all([
    getWatchlistSnapshot(user.id),
    listSecurities(),
  ]);

  const securityOptions = securities.map((s) => ({
    id: s.id,
    ticker: s.ticker,
    name: s.name,
    currency: s.currency,
  }));
  const watchedSecurityIds = new Set(items.map((i) => i.securityId));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Watchlist</h1>
          <p className="text-sm text-muted-foreground">
            Securities you&apos;re tracking without owning — {items.length} ticker
            {items.length === 1 ? "" : "s"}
          </p>
        </div>
        <AddWatchlistDialog existingSecurities={securityOptions} watchedSecurityIds={watchedSecurityIds} />
      </div>

      <WatchlistTable items={items} />
    </div>
  );
}
