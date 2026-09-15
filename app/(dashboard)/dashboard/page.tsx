import Link from "next/link";
import Decimal from "decimal.js";
import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import { getRebalancingPlan } from "@/lib/portfolio/rebalancingService";
import { calculateAllocation } from "@/lib/finance/allocation";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { AllocationCard } from "@/components/dashboard/allocation-card";
import { RebalancingCard, type RebalancingPlanData } from "@/components/dashboard/rebalancing-card";
import { RefreshAllButton } from "@/components/dashboard/refresh-all-button";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
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

  const [snapshot, rebalancingPlans] = await Promise.all([
    getPortfolioSnapshot(user.id, portfolio.id),
    Promise.all(
      REBALANCING_DIMENSIONS.map((dimension) =>
        getRebalancingPlan(user.id, portfolio.id, dimension)
      )
    ),
  ]);
  const { baseCurrency } = snapshot;
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
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

        <div className="rounded-xl bg-card text-card-foreground shadow-sm shadow-black/5 ring-1 ring-foreground/5">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-medium">Top Holdings</h2>
          </div>
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
        </div>
      </div>

      <RebalancingCard plans={rebalancingPlanData} baseCurrency={baseCurrency} />
    </div>
  );
}
