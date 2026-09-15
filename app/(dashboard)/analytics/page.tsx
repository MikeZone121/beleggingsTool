import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getPerformanceSnapshot } from "@/lib/performance/performanceService";
import { getBenchmarkComparison } from "@/lib/performance/benchmarkService";
import { getPortfolioValueHistory } from "@/lib/performance/portfolioValueHistoryService";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import { calculateDrawdown } from "@/lib/finance/drawdown";
import { calculateHoldingsInsights } from "@/lib/finance/holdingsInsights";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { formatDate, pnlTone } from "@/lib/utils/format";
import { Money, Percent } from "@/components/ui/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BenchmarkCard } from "@/components/analytics/benchmark-card";
import { SyncPriceHistoryButton } from "@/components/analytics/sync-price-history-button";

/** MSCI World ETF — a reasonable global-equity default; the user can
 * compare against anything resolvable by the configured provider. */
const DEFAULT_BENCHMARK_TICKER = "URTH";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  if (!portfolio) {
    return <EmptyState title="No portfolio yet" description="No default portfolio was found." />;
  }

  const [performance, benchmark, valueHistory, snapshot] = await Promise.all([
    getPerformanceSnapshot(user.id, portfolio.id),
    getBenchmarkComparison(user.id, portfolio.id, DEFAULT_BENCHMARK_TICKER),
    getPortfolioValueHistory(user.id, portfolio.id),
    getPortfolioSnapshot(user.id, portfolio.id),
  ]);

  const drawdown = calculateDrawdown(valueHistory);
  const holdingsInsights = calculateHoldingsInsights(snapshot.holdings);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">{portfolio.name}</p>
        </div>
        <SyncPriceHistoryButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Money-Weighted Return (XIRR)"
          value={
            performance.xirr ? (
              <Percent value={performance.xirr.toString()} signDisplay="always" />
            ) : (
              "Not computable"
            )
          }
          sublabel="Annualized, accounts for the timing of deposits/withdrawals"
          tone={pnlTone(performance.xirr)}
        />
        <KpiCard
          label="Total Return"
          value={
            performance.totalReturn ? (
              <Percent value={performance.totalReturn.toString()} signDisplay="always" />
            ) : (
              "Not computable"
            )
          }
          sublabel="Ending value vs. net cash contributed"
          tone={pnlTone(performance.totalReturn)}
        />
        <KpiCard
          label="Net Cash Contributed"
          value={
            <Money value={performance.netExternalCashIn.toString()} currency={performance.baseCurrency} />
          }
          sublabel={performance.hasMissingFx ? "Incomplete — missing FX rate" : "Deposits minus withdrawals"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Risk &amp; Concentration</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="Max Drawdown"
            value={<Percent value={drawdown.maxDrawdown.toString()} />}
            sublabel={
              drawdown.maxDrawdownDate
                ? `Worst point: ${formatDate(drawdown.maxDrawdownDate)}`
                : "No decline from a peak yet"
            }
            tone={drawdown.maxDrawdown.isZero() ? undefined : "negative"}
          />
          <KpiCard
            label="Top 3 Concentration"
            value={<Percent value={holdingsInsights.topConcentration.toString()} />}
            sublabel="Share of value in your 3 largest positions"
          />
          <KpiCard
            label="Best Holding"
            value={holdingsInsights.best ? holdingsInsights.best.ticker : "—"}
            sublabel={
              holdingsInsights.best?.unrealizedPnLPercent ? (
                <Percent value={holdingsInsights.best.unrealizedPnLPercent.toString()} signDisplay="always" />
              ) : (
                "No holdings with a computable return"
              )
            }
            tone="positive"
          />
          <KpiCard
            label="Worst Holding"
            value={holdingsInsights.worst ? holdingsInsights.worst.ticker : "—"}
            sublabel={
              holdingsInsights.worst?.unrealizedPnLPercent ? (
                <Percent value={holdingsInsights.worst.unrealizedPnLPercent.toString()} signDisplay="always" />
              ) : (
                "No holdings with a computable return"
              )
            }
            tone="negative"
          />
        </div>
      </div>

      <BenchmarkCard
        initialTicker={benchmark.benchmarkTicker}
        initialPoints={benchmark.points}
        currency={performance.baseCurrency}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Methodology</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ul className="list-disc space-y-1 pl-4">
            <li>
              <span className="text-foreground">XIRR</span> solves for the annualized rate that
              discounts every deposit (negative), withdrawal (positive), and the current
              portfolio value (a final positive cash flow) to zero — the same definition as
              Excel&apos;s XIRR.
            </li>
            <li>
              <span className="text-foreground">Total return</span> compares the current value
              to net cash actually contributed (deposits minus withdrawals) — it is not
              time-weighted, so it doesn&apos;t correct for the timing of those contributions.
            </li>
            <li>
              A reconstructed daily value history now exists (see the benchmark chart above), but
              it isn&apos;t yet wired into a proper time-weighted return here — that would chain
              sub-period returns between each cash flow rather than sample evenly, which this
              KPI doesn&apos;t do.
            </li>
            <li>
              <span className="text-foreground">Max drawdown</span> is the largest peak-to-trough
              decline in that same reconstructed value history — the worst-case
              &ldquo;if you&apos;d bought at the top and sold at the bottom&rdquo; so far.
            </li>
            <li>
              <span className="text-foreground">Best/worst holding</span> and{" "}
              <span className="text-foreground">concentration</span> use each holding&apos;s
              current unrealized return and market value — a live snapshot, not a historical
              series.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
