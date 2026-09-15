import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getPerformanceSnapshot } from "@/lib/performance/performanceService";
import { getBenchmarkComparison } from "@/lib/performance/benchmarkService";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { pnlTone } from "@/lib/utils/format";
import { Money, Percent } from "@/components/ui/money";
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

  const [performance, benchmark] = await Promise.all([
    getPerformanceSnapshot(user.id, portfolio.id),
    getBenchmarkComparison(user.id, portfolio.id, DEFAULT_BENCHMARK_TICKER),
  ]);

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

      <BenchmarkCard
        initialTicker={benchmark.benchmarkTicker}
        initialPoints={benchmark.points}
      />

      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground">Methodology</p>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          <li>
            <span className="text-foreground">XIRR</span> solves for the annualized rate that
            discounts every deposit (negative), withdrawal (positive), and the current portfolio
            value (a final positive cash flow) to zero — the same definition as Excel&apos;s XIRR.
          </li>
          <li>
            <span className="text-foreground">Total return</span> compares the current value to
            net cash actually contributed (deposits minus withdrawals) — it is not time-weighted,
            since that requires a daily portfolio-value history this app doesn&apos;t yet compute
            (a later phase, once historical prices are available).
          </li>
          <li>Time-weighted return (TWR) is not yet implemented for the same reason.</li>
        </ul>
      </div>
    </div>
  );
}
