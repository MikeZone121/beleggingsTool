import Link from "next/link";
import Decimal from "decimal.js";
import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import { getPreviousClosePrices } from "@/lib/db/prices";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Money, Percent } from "@/components/ui/money";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { pnlTone } from "@/lib/utils/format";
import { RefreshPricesButton } from "@/components/securities/refresh-prices-button";
import { HoldingsTable, type HoldingRow, type CashRowData } from "@/components/portfolio/holdings-table";

export default async function PortfolioPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  if (!portfolio) {
    return <EmptyState title="No portfolio yet" description="No default portfolio was found." />;
  }

  const snapshot = await getPortfolioSnapshot(user.id, portfolio.id);
  const { baseCurrency } = snapshot;
  const hasCash = !snapshot.cashBalance.balanceBase.isZero();

  if (snapshot.holdings.length === 0 && !hasCash) {
    return (
      <EmptyState
        title="No holdings yet"
        description="Record a DEPOSIT to add cash, then a BUY to start tracking holdings."
        action={
          <Button render={<Link href="/transactions" />} nativeButton={false}>
            Add your first transaction
          </Button>
        }
      />
    );
  }

  const holdings = snapshot.holdings
    .slice()
    .sort((a, b) =>
      (b.marketValueBase ?? new Decimal(0)).comparedTo(a.marketValueBase ?? new Decimal(0))
    );

  const previousCloses = await getPreviousClosePrices(
    holdings.map((h) => h.securityId),
    new Date()
  );

  const holdingRows: HoldingRow[] = holdings.map((holding) => {
    const weight = snapshot.totalValue.greaterThan(0)
      ? (holding.marketValueBase ?? new Decimal(0)).dividedBy(snapshot.totalValue)
      : null;
    const returnPercent =
      holding.costBasis.greaterThan(0) && holding.unrealizedPnL
        ? holding.unrealizedPnL.dividedBy(holding.costBasis)
        : null;
    const currentPrice = holding.marketValue
      ? holding.marketValue.dividedBy(holding.quantity)
      : null;
    const previousClose = previousCloses.get(holding.securityId);
    const dayChangePercent =
      currentPrice && previousClose && !new Decimal(previousClose).isZero()
        ? currentPrice.minus(previousClose).dividedBy(previousClose)
        : null;

    return {
      securityId: holding.securityId,
      ticker: holding.ticker,
      name: holding.name,
      currency: holding.currency,
      quantity: holding.quantity.toString(),
      averageCost: holding.averageCost.toString(),
      currentPrice: currentPrice?.toString() ?? null,
      priceStale: holding.priceStale,
      dayChangePercent: dayChangePercent?.toString() ?? null,
      marketValueBase: holding.marketValueBase?.toString() ?? null,
      weight: weight?.toString() ?? null,
      unrealizedPnLBase: holding.unrealizedPnLBase?.toString() ?? null,
      returnPercent: returnPercent?.toString() ?? null,
      tone: pnlTone(holding.unrealizedPnL),
    };
  });

  const cashWeight = snapshot.totalValue.greaterThan(0)
    ? snapshot.cashBalance.balanceBase.dividedBy(snapshot.totalValue)
    : null;
  const cashRow: CashRowData | null = hasCash
    ? {
        baseCurrency,
        balanceBase: snapshot.cashBalance.balanceBase.toString(),
        weight: cashWeight?.toString() ?? null,
      }
    : null;

  // Holdings' combined market value and weight — cash's counterpart below,
  // so "how much of my money is invested vs. sitting as cash" is visible
  // before scanning the table at all, not something you have to add up
  // from individual rows.
  const holdingsValueBase = snapshot.totalValue.minus(snapshot.cashBalance.balanceBase);
  const holdingsWeight = snapshot.totalValue.greaterThan(0)
    ? holdingsValueBase.dividedBy(snapshot.totalValue)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Portfolio</h1>
          <p className="text-sm text-muted-foreground">
            {holdings.length} holding{holdings.length === 1 ? "" : "s"}
            {hasCash ? " + cash" : ""} · {portfolio.name}
          </p>
        </div>
        <RefreshPricesButton />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Total Value"
          value={<Money value={snapshot.totalValue.toString()} currency={baseCurrency} />}
          sublabel="Holdings + cash"
          highlight
        />
        <KpiCard
          label="Invested"
          value={<Money value={holdingsValueBase.toString()} currency={baseCurrency} />}
          sublabel={
            holdingsWeight ? (
              <>
                <Percent value={holdingsWeight.toString()} /> of total
              </>
            ) : undefined
          }
        />
        <KpiCard
          label="Cash"
          value={<Money value={snapshot.cashBalance.balanceBase.toString()} currency={baseCurrency} />}
          sublabel={
            cashWeight ? (
              <>
                <Percent value={cashWeight.toString()} /> of total
              </>
            ) : undefined
          }
        />
      </div>

      <HoldingsTable holdings={holdingRows} cash={cashRow} baseCurrency={baseCurrency} />
    </div>
  );
}
