import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getSecurityChartData } from "@/lib/portfolio/securityChartService";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SecurityPriceChart } from "@/components/charts/security-price-chart";

interface RouteParams {
  params: Promise<{ securityId: string }>;
}

export default async function WatchlistSecurityPage({ params }: RouteParams) {
  await requireUser();
  const { securityId } = await params;

  const chart = await getSecurityChartData(securityId);

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
        <h1 className="text-2xl font-semibold">{chart.ticker}</h1>
        <p className="text-sm text-muted-foreground">{chart.name}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Price, SMA 25/50/100 &amp; Fibonacci Retracement</CardTitle>
        </CardHeader>
        <CardContent>
          <SecurityPriceChart data={chart.points} fibonacciLevels={chart.fibonacciLevels} currency={chart.currency} />
          <p className="mt-3 text-xs text-muted-foreground">
            The Fibonacci grid marks the 0/23.6/38.2/50/61.8/78.6/100% retracement levels between the
            highest and lowest close in the history shown — not a signal or recommendation, just a
            commonly-watched reference.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
