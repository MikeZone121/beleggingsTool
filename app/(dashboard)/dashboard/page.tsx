import Link from "next/link";
import Decimal from "decimal.js";
import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import { getRebalancingPlan } from "@/lib/portfolio/rebalancingService";
import { getTodaySummary } from "@/lib/portfolio/todayMoversService";
import { getDividendSnapshot, getDividendCalendar } from "@/lib/dividends/dividendService";
import { calculateAllocation } from "@/lib/finance/allocation";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AllocationCard } from "@/components/dashboard/allocation-card";
import { RebalancingCard, type RebalancingPlanData } from "@/components/dashboard/rebalancing-card";
import { RefreshAllButton } from "@/components/dashboard/refresh-all-button";
import { TodayCard } from "@/components/dashboard/today-card";
import { NextDividendCard } from "@/components/dashboard/next-dividend-card";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money, Percent } from "@/components/ui/money";
import { pnlTone } from "@/lib/utils/format";
import type { AllocationChartBucket } from "@/components/charts/allocation-bar";

const REBALANCING_DIMENSIONS = ["assetType", "sector", "currency"] as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  if (!portfolio) {
    return (
      <EmptyState
        title="No portfolio yet"
        description="Something went wrong setting up your account — no default portfolio was found."
      />
    );
  }

  const [snapshot, rebalancingPlans, todaySummary, dividendSnapshot, dividendCalendar] =
    await Promise.all([
      getPortfolioSnapshot(user.id, portfolio.id),
      Promise.all(
        REBALANCING_DIMENSIONS.map((dimension) =>
          getRebalancingPlan(user.id, portfolio.id, dimension)
        )
      ),
      getTodaySummary(user.id, portfolio.id),
      getDividendSnapshot(user.id, portfolio.id),
      getDividendCalendar(user.id, portfolio.id),
    ]);
  const { baseCurrency } = snapshot;

  // getDividendCalendar already sorts by estimated ex-date ascending, so
  // the first row is the nearest upcoming one.
  const nextDividend = dividendCalendar.at(0) ?? null;

  // Total return = price appreciation (realized + unrealized) plus every
  // dividend ever received, all in the base currency — the one number a
  // "did this investment actually pay off" question needs, instead of
  // making the reader mentally add three separate KPI cards (and easy to
  // forget the dividends piece, since it's not on this page at all
  // otherwise).
  let totalDividendsBase = new Decimal(0);
  let dividendsHaveMissingFx = false;
  for (const cashflow of dividendSnapshot.cashflows) {
    if (cashflow.netAmountBase === null) {
      dividendsHaveMissingFx = true;
      continue;
    }
    totalDividendsBase = totalDividendsBase.plus(cashflow.netAmountBase);
  }
  const totalReturn = snapshot.totalUnrealizedPnL.plus(snapshot.totalRealizedPnL).plus(totalDividendsBase);
  const totalReturnPercent =
    !snapshot.totalCostBasis.isZero() && snapshot.totalCostBasis.isPositive()
      ? totalReturn.dividedBy(snapshot.totalCostBasis)
      : null;
  const totalReturnHasMissingFx = snapshot.realizedPnLHasMissingFx || dividendsHaveMissingFx;
  const rebalancingPlanData: RebalancingPlanData[] = rebalancingPlans.map((plan) => ({
    dimension: plan.dimension as RebalancingPlanData["dimension"],
    totalValue: plan.totalValue.toString(),
    totalTargetWeight: plan.totalTargetWeight.toString(),
    rows: plan.rows.map((row) => ({
      key: row.key,
      label: row.label,
      currentWeight: row.currentWeight.toString(),
      targetWeight: row.targetWeight?.toString() ?? null,
      targetId: row.targetId,
      driftWeight: row.driftWeight?.toString() ?? null,
      suggestedTradeBase: row.suggestedTradeBase?.toString() ?? null,
    })),
  }));
  const returnPercent =
    !snapshot.totalCostBasis.isZero() && snapshot.totalCostBasis.isPositive()
      ? snapshot.totalUnrealizedPnL.dividedBy(snapshot.totalCostBasis)
      : null;

  function toChartBuckets(
    dimension: Parameters<typeof calculateAllocation>[1]
  ): AllocationChartBucket[] {
    return calculateAllocation(snapshot.holdings, dimension).map((b) => ({
      key: b.key,
      label: b.label,
      value: b.valueBase.toNumber(),
      weight: b.weight.toNumber(),
    }));
  }

  if (snapshot.holdings.length === 0) {
    return (
      <EmptyState
        title="No holdings yet"
        description="Add your first transaction to start tracking your portfolio's value and performance."
        action={
          <Button render={<Link href="/transactions" />} nativeButton={false}>
            Add your first transaction
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {portfolio.name} · base currency {baseCurrency}
          </p>
        </div>
        <RefreshAllButton />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TodayCard
          totalChangeBase={todaySummary.totalChangeBase}
          totalChangePercent={todaySummary.totalChangePercent}
          movers={todaySummary.rows}
          baseCurrency={baseCurrency}
          hasData={todaySummary.hasData}
        />
        <NextDividendCard
          ticker={nextDividend?.ticker ?? null}
          name={nextDividend?.name ?? null}
          exDate={nextDividend?.estimate.estimatedNextExDate.toISOString() ?? null}
          netBase={nextDividend?.payout.netBase?.toString() ?? null}
          baseCurrency={baseCurrency}
          daysUntil={nextDividend?.daysUntilExDate ?? null}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <KpiCard
          label="Portfolio Value"
          value={<Money value={snapshot.totalValue.toString()} currency={baseCurrency} />}
          sublabel={
            snapshot.cashBalance.hasMissingFx
              ? "Incomplete — missing FX rate"
              : "Holdings + cash"
          }
          highlight
        />
        <KpiCard
          label="Total Return"
          value={<Money value={totalReturn.toString()} currency={baseCurrency} signDisplay="always" />}
          sublabel={
            totalReturnHasMissingFx ? (
              "Incomplete — missing FX rate"
            ) : (
              <>
                {totalReturnPercent && <Percent value={totalReturnPercent.toString()} signDisplay="always" />}
                {" · price P&L + "}
                <Money value={totalDividendsBase.toString()} currency={baseCurrency} /> dividends
              </>
            )
          }
          tone={pnlTone(totalReturn)}
          highlight
        />
        <KpiCard
          label="Cash Balance"
          value={
            <Money value={snapshot.cashBalance.balanceBase.toString()} currency={baseCurrency} />
          }
          sublabel={
            snapshot.cashBalance.hasExcludedTransactions
              ? "Excludes TRANSFER/OTHER transactions"
              : undefined
          }
        />
        <KpiCard
          label="Unrealized P&L"
          value={
            <Money
              value={snapshot.totalUnrealizedPnL.toString()}
              currency={baseCurrency}
              signDisplay="always"
            />
          }
          sublabel={
            returnPercent ? <Percent value={returnPercent.toString()} signDisplay="always" /> : undefined
          }
          tone={pnlTone(snapshot.totalUnrealizedPnL)}
        />
        <KpiCard
          label="Realized P&L"
          value={
            <Money
              value={snapshot.totalRealizedPnL.toString()}
              currency={baseCurrency}
              signDisplay="always"
            />
          }
          sublabel={snapshot.realizedPnLHasMissingFx ? "Incomplete — missing FX rate for a sale" : undefined}
          tone={pnlTone(snapshot.totalRealizedPnL)}
        />
        <KpiCard
          label="Cost Basis"
          value={<Money value={snapshot.totalCostBasis.toString()} currency={baseCurrency} />}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <AllocationCard
          byAssetType={toChartBuckets("assetType")}
          bySector={toChartBuckets("sector")}
          byCurrency={toChartBuckets("currency")}
          baseCurrency={baseCurrency}
        />

        <Card>
          <CardHeader className="border-b border-border">
            <CardTitle className="text-base">Top Holdings</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="divide-y divide-border">
              {snapshot.holdings
                .slice()
                .sort((a, b) =>
                  (b.marketValueBase ?? new Decimal(0)).comparedTo(a.marketValueBase ?? new Decimal(0))
                )
                .slice(0, 5)
                .map((holding) => (
                  <div key={holding.securityId} className="flex items-center justify-between px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium">{holding.ticker}</div>
                      <div className="text-muted-foreground">{holding.name}</div>
                    </div>
                    <div className="text-right tabular-nums">
                      <div>
                        <Money value={holding.marketValueBase?.toString()} currency={baseCurrency} />
                      </div>
                      <div className="text-muted-foreground">
                        <Money value={holding.marketValue?.toString()} currency={holding.currency} />
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <RebalancingCard plans={rebalancingPlanData} baseCurrency={baseCurrency} />
    </div>
  );
}
