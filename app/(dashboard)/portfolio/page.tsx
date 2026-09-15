import Link from "next/link";
import Decimal from "decimal.js";
import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
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

  const holdingRows: HoldingRow[] = holdings.map((holding) => {
    const weight = snapshot.totalValue.greaterThan(0)
      ? (holding.marketValueBase ?? new Decimal(0)).dividedBy(snapshot.totalValue)
      : null;
    const returnPercent =
      holding.costBasis.greaterThan(0) && holding.unrealizedPnL
        ? holding.unrealizedPnL.dividedBy(holding.costBasis)
        : null;

    return {
      securityId: holding.securityId,
      ticker: holding.ticker,
      name: holding.name,
      currency: holding.currency,
      quantity: holding.quantity.toString(),
      averageCost: holding.averageCost.toString(),
      currentPrice: holding.marketValue
        ? holding.marketValue.dividedBy(holding.quantity).toString()
        : null,
      priceStale: holding.priceStale,
      marketValueBase: holding.marketValueBase?.toString() ?? null,
      weight: weight?.toString() ?? null,
      unrealizedPnLBase: holding.unrealizedPnLBase?.toString() ?? null,
      returnPercent: returnPercent?.toString() ?? null,
      tone: pnlTone(holding.unrealizedPnL),
    };
  });

  const cashRow: CashRowData | null = hasCash
    ? {
        baseCurrency,
        balanceBase: snapshot.cashBalance.balanceBase.toString(),
        weight: snapshot.totalValue.greaterThan(0)
          ? snapshot.cashBalance.balanceBase.dividedBy(snapshot.totalValue).toString()
          : null,
      }
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

      <HoldingsTable holdings={holdingRows} cash={cashRow} baseCurrency={baseCurrency} />
    </div>
  );
}
