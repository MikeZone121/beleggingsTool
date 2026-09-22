import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getSecurityChartData } from "@/lib/portfolio/securityChartService";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Money, Percent } from "@/components/ui/money";
import { SecurityPriceChart } from "@/components/charts/security-price-chart";
import { RefreshWatchlistButton } from "@/components/watchlist/refresh-watchlist-button";
import { formatRelativeTime, pnlToneClass } from "@/lib/utils/format";
import { getUserLocale } from "@/lib/utils/serverLocale";

interface RouteParams {
  params: Promise<{ securityId: string }>;
}

export default async function WatchlistSecurityPage({ params }: RouteParams) {
  await requireUser();
  const { securityId } = await params;

  const [chart, locale] = await Promise.all([getSecurityChartData(securityId), getUserLocale()]);

  if (!chart) {
    return <EmptyState title="Not found" description="This security doesn't exist." />;
  }


  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          render={<Link href="/watchlist" />}
          nativeButton={false}
          className="mb-2 -ml-2"
        >
          <ArrowLeft className="size-4" />
          Watchlist
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{chart.ticker}</h1>
            <p className="text-sm text-muted-foreground">{chart.name}</p>
          </div>
          {/* The same refresh as on the Watchlist page: it re-fetches every
              watched ticker, so the chart below can never be newer than the
              price above it. */}
          <RefreshWatchlistButton />
        </div>
        <div className="mt-3 flex flex-wrap items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums">
            {chart.currentPrice ? (
              <Money value={chart.currentPrice} currency={chart.currency} />
            ) : (
              <span className="text-base text-muted-foreground">No price yet</span>
            )}
          </span>
          {chart.dayChangePercent && (
            <span className={`tabular-nums ${pnlToneClass(chart.dayChangePercent)}`}>
              <Percent value={chart.dayChangePercent} signDisplay="always" /> today
            </span>
          )}
          {chart.priceAsOf && (
            <span className="text-xs text-muted-foreground">
              updated {formatRelativeTime(chart.priceAsOf, { locale })}
            </span>
          )}
          {chart.priceStale && <Badge variant="secondary">stale</Badge>}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price, SMA 25/50/100 &amp; Fibonacci Retracement</CardTitle>
        </CardHeader>
        <CardContent>
          <SecurityPriceChart data={chart.points} fibonacciLevels={chart.fibonacciLevels} currency={chart.currency} />
          <p className="mt-3 text-xs text-muted-foreground">
            Drag the handles on the strip below the chart to zoom into a date range — useful when a
            long price history makes recent, smaller moves hard to read against an old high or low.
            The Fibonacci grid marks the 0/23.6/38.2/50/61.8/78.6/100% retracement levels between the
            highest and lowest close in the history shown — not a signal or recommendation, just a
            commonly-watched reference.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
