import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getPerformanceSnapshot } from "@/lib/performance/performanceService";
import { getBenchmarkComparison } from "@/lib/performance/benchmarkService";
import { getPortfolioValueHistory } from "@/lib/performance/portfolioValueHistoryService";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import { listTransactionsForPortfolio } from "@/lib/db/transactions";
import { listExchangeRates } from "@/lib/db/exchangeRates";
import { toDomainTransaction, toFxRate } from "@/lib/db/mappers";
import { calculateDrawdown } from "@/lib/finance/drawdown";
import { calculateHoldingsInsights } from "@/lib/finance/holdingsInsights";
import { calculateVolatilityMetrics, calculateBeta } from "@/lib/finance/riskMetrics";
import { calculateCostsSummary } from "@/lib/finance/costsMetrics";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { formatDate, pnlTone } from "@/lib/utils/format";
import { Money, Percent } from "@/components/ui/money";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BenchmarkCard } from "@/components/analytics/benchmark-card";
import { SyncPriceHistoryButton } from "@/components/analytics/sync-price-history-button";
import { StressTestCard } from "@/components/analytics/stress-test-card";
import { getCorrelationMatrix } from "@/lib/portfolio/correlationMatrixService";
import { CorrelationMatrix } from "@/components/analytics/correlation-matrix";
import { AnalyticsTabs } from "@/components/analytics/analytics-tabs";

/** SPDR MSCI ACWI IMI UCITS ETF on Borsa Italiana — EUR-quoted, and
 * broader than a developed-markets MSCI World (it includes emerging
 * markets and small caps). Quoted in EUR on purpose: a USD-listed
 * equivalent would fold USD/EUR moves into the comparison line and make
 * the portfolio look like it beat or trailed the index on currency
 * alone. The user can compare against anything the provider resolves. */
const DEFAULT_BENCHMARK_TICKER = "IMIE.MI";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  if (!portfolio) {
    return <EmptyState title="No portfolio yet" description="No default portfolio was found." />;
  }

  const [performance, benchmark, valueHistory, snapshot, transactionRows, fxRateRows, correlation] =
    await Promise.all([
      getPerformanceSnapshot(user.id, portfolio.id),
      getBenchmarkComparison(user.id, portfolio.id, DEFAULT_BENCHMARK_TICKER),
      getPortfolioValueHistory(user.id, portfolio.id),
      getPortfolioSnapshot(user.id, portfolio.id),
      listTransactionsForPortfolio(user.id, portfolio.id),
      listExchangeRates(),
      getCorrelationMatrix(user.id, portfolio.id),
    ]);

  const drawdown = calculateDrawdown(valueHistory);
  const holdingsInsights = calculateHoldingsInsights(snapshot.holdings);
  const volatility = calculateVolatilityMetrics(valueHistory);
  const beta = calculateBeta(benchmark.points);
  const costs = calculateCostsSummary(transactionRows.map(toDomainTransaction), {
    baseCurrency: portfolio.baseCurrency,
    fxRates: fxRateRows.map(toFxRate),
  });
  const totalCostsBase = costs.totalFeesBase.plus(costs.totalTaxesBase);
  const latestYearCosts = costs.byYear.at(-1) ?? null;
  const holdingsValueBase = snapshot.totalValue.minus(snapshot.cashBalance.balanceBase);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Analytics</h1>
          <p className="text-sm text-muted-foreground">{portfolio.name}</p>
        </div>
        <SyncPriceHistoryButton />
      </div>

      <AnalyticsTabs
        performance={
          <>
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
                  <Money
                    value={performance.netExternalCashIn.toString()}
                    currency={performance.baseCurrency}
                  />
                }
                sublabel={
                  performance.hasMissingFx ? "Incomplete — missing FX rate" : "Deposits minus withdrawals"
                }
              />
            </div>
            <BenchmarkCard
              initialTicker={benchmark.benchmarkTicker}
              initialPoints={benchmark.points}
              initialError={benchmark.benchmarkError}
              currency={performance.baseCurrency}
            />
          </>
        }
        risk={
          <>
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
                    <Percent
                      value={holdingsInsights.best.unrealizedPnLPercent.toString()}
                      signDisplay="always"
                    />
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
                    <Percent
                      value={holdingsInsights.worst.unrealizedPnLPercent.toString()}
                      signDisplay="always"
                    />
                  ) : (
                    "No holdings with a computable return"
                  )
                }
                tone="negative"
              />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <KpiCard
                label="Sharpe Ratio"
                value={volatility.sharpeRatio ? volatility.sharpeRatio.toFixed(2) : "—"}
                sublabel="Annualized, assumes 0% risk-free rate"
                tone={
                  volatility.sharpeRatio
                    ? volatility.sharpeRatio.greaterThanOrEqualTo(0)
                      ? "positive"
                      : "negative"
                    : undefined
                }
              />
              <KpiCard
                label="Sortino Ratio"
                value={volatility.sortinoRatio ? volatility.sortinoRatio.toFixed(2) : "—"}
                sublabel="Like Sharpe, but only penalizes downside moves"
                tone={
                  volatility.sortinoRatio
                    ? volatility.sortinoRatio.greaterThanOrEqualTo(0)
                      ? "positive"
                      : "negative"
                    : undefined
                }
              />
              <KpiCard
                label="Beta"
                value={beta ? beta.toFixed(2) : "—"}
                sublabel={`vs. ${benchmark.benchmarkTicker} — 1.00 = moves with the market`}
              />
            </div>
            <StressTestCard
              holdingsValueBase={holdingsValueBase.toString()}
              cashBase={snapshot.cashBalance.balanceBase.toString()}
              baseCurrency={performance.baseCurrency}
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Diversification</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Correlation of daily returns between each pair of holdings — near +1.00 means
                  they move almost in lockstep (not real diversification, even if they&apos;re in
                  different sectors), near 0 or negative means they genuinely offset each other.
                </p>
              </CardHeader>
              <CardContent>
                <CorrelationMatrix tickers={correlation.tickers} cells={correlation.cells} />
              </CardContent>
            </Card>
          </>
        }
        costs={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <KpiCard
              label="Total Fees &amp; Taxes"
              value={<Money value={totalCostsBase.toString()} currency={performance.baseCurrency} />}
              sublabel={costs.hasMissingFx ? "Incomplete — missing FX rate" : "Since your first transaction"}
              highlight
            />
            <KpiCard
              label="Broker Fees"
              value={<Money value={costs.totalFeesBase.toString()} currency={performance.baseCurrency} />}
            />
            <KpiCard
              label="Taxes"
              value={<Money value={costs.totalTaxesBase.toString()} currency={performance.baseCurrency} />}
              sublabel={
                latestYearCosts ? (
                  <>
                    <Money
                      value={latestYearCosts.taxesBase.toString()}
                      currency={performance.baseCurrency}
                    />{" "}
                    in {latestYearCosts.year}
                  </>
                ) : undefined
              }
            />
          </div>
        }
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
            <li>
              <span className="text-foreground">Sharpe</span> and{" "}
              <span className="text-foreground">Sortino ratio</span> are annualized from that same
              reconstructed value history, assuming a 0% risk-free rate (this app has no bond-yield
              data source, so that&apos;s the honest simplification rather than a hardcoded number
              that goes stale). Sortino only penalizes downside moves; Sharpe penalizes all of it.
            </li>
            <li>
              <span className="text-foreground">Beta</span> is against the benchmark chart&apos;s
              default ticker specifically — switching the ticker in the chart above doesn&apos;t
              recompute it.
            </li>
            <li>
              <span className="text-foreground">Total Fees &amp; Taxes</span> sums every
              transaction&apos;s recorded fees and taxes fields (broker commissions, and whatever
              you&apos;ve entered as taxes — e.g. Belgian beurstaks) since your first transaction —
              it doesn&apos;t estimate taxes you haven&apos;t recorded.
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
