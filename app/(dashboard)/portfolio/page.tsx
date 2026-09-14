import Link from "next/link";
import Decimal from "decimal.js";
import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatPercent, formatQuantity, pnlTone } from "@/lib/utils/format";
import { EditPricePopover } from "@/components/securities/edit-price-popover";

export default async function PortfolioPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  if (!portfolio) {
    return <EmptyState title="No portfolio yet" description="No default portfolio was found." />;
  }

  const snapshot = await getPortfolioSnapshot(user.id, portfolio.id);
  const { baseCurrency } = snapshot;

  if (snapshot.holdings.length === 0) {
    return (
      <EmptyState
        title="No holdings yet"
        description="Buy transactions will show up here as holdings once you add them."
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Portfolio</h1>
        <p className="text-sm text-muted-foreground">
          {holdings.length} holding{holdings.length === 1 ? "" : "s"} · {portfolio.name}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Security</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead className="text-right">Avg. Cost</TableHead>
              <TableHead className="text-right">Current Price</TableHead>
              <TableHead className="text-right">Market Value</TableHead>
              <TableHead className="text-right">Weight</TableHead>
              <TableHead className="text-right">Unrealized P&L</TableHead>
              <TableHead className="text-right">Return %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => {
              const weight = snapshot.totalValue.greaterThan(0)
                ? (holding.marketValueBase ?? new Decimal(0)).dividedBy(snapshot.totalValue)
                : null;
              const returnPercent =
                holding.costBasis.greaterThan(0) && holding.unrealizedPnL
                  ? holding.unrealizedPnL.dividedBy(holding.costBasis)
                  : null;
              const tone = pnlTone(holding.unrealizedPnL);
              const pnlToneClass =
                tone === "positive"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : tone === "negative"
                    ? "text-red-600 dark:text-red-400"
                    : "";

              return (
                <TableRow key={holding.securityId}>
                  <TableCell>
                    <div className="font-medium">{holding.ticker}</div>
                    <div className="text-xs text-muted-foreground">{holding.name}</div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatQuantity(holding.quantity)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(holding.averageCost, holding.currency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <div className="flex items-center justify-end gap-1">
                      {holding.marketValue ? (
                        <span>
                          {formatCurrency(
                            holding.marketValue.dividedBy(holding.quantity),
                            holding.currency
                          )}
                        </span>
                      ) : (
                        <Badge variant="secondary">no price</Badge>
                      )}
                      {holding.priceStale && holding.marketValue && (
                        <Badge variant="secondary">stale</Badge>
                      )}
                      <EditPricePopover
                        securityId={holding.securityId}
                        ticker={holding.ticker}
                        currency={holding.currency}
                        currentPrice={
                          holding.marketValue
                            ? holding.marketValue.dividedBy(holding.quantity).toString()
                            : null
                        }
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatCurrency(holding.marketValueBase, baseCurrency)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {weight ? formatPercent(weight) : "—"}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${pnlToneClass}`}>
                    {formatCurrency(holding.unrealizedPnLBase, baseCurrency, { signDisplay: "always" })}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums ${pnlToneClass}`}>
                    {returnPercent ? formatPercent(returnPercent, { signDisplay: "always" }) : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
