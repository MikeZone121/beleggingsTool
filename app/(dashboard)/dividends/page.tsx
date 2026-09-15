import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { listSecurities } from "@/lib/db/securities";
import { getDividendSnapshot } from "@/lib/dividends/dividendService";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { MonthlyIncomeChart } from "@/components/charts/monthly-income-chart";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/utils/format";
import { Money, Percent } from "@/components/ui/money";

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function monthLabel(periodKey: string): string {
  const [year, month] = periodKey.split("-");
  return `${MONTH_LABELS[Number(month) - 1]} '${year.slice(2)}`;
}

export default async function DividendsPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  if (!portfolio) {
    return <EmptyState title="No portfolio yet" description="No default portfolio was found." />;
  }

  const [snapshot, securities] = await Promise.all([
    getDividendSnapshot(user.id, portfolio.id),
    listSecurities(),
  ]);
  const { baseCurrency } = snapshot;
  const tickerBySecurityId = new Map(securities.map((s) => [s.id, s.ticker]));

  if (snapshot.cashflows.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">Dividends</h1>
        <EmptyState
          title="No dividend income yet"
          description="Record a DIVIDEND transaction to start tracking your dividend income, yield, and growth."
        />
      </div>
    );
  }

  const chartData = snapshot.monthlyIncome.slice(-24).map((p) => ({
    periodKey: p.periodKey,
    label: monthLabel(p.periodKey),
    income: p.income.toNumber(),
  }));

  const latestGrowth = snapshot.portfolioGrowth.yoyGrowth.at(-1) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Dividends</h1>
        <p className="text-sm text-muted-foreground">{portfolio.name}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Trailing 12-Month Income"
          value={<Money value={snapshot.ttmIncome.total.toString()} currency={baseCurrency} />}
          sublabel={snapshot.ttmIncome.hasMissingFx ? "Incomplete — missing FX rate" : undefined}
        />
        <KpiCard
          label="Latest Full-Year Income"
          value={
            snapshot.portfolioGrowth.incomeByYear.length > 0 ? (
              <Money
                value={snapshot.portfolioGrowth.incomeByYear.at(-1)!.income.toString()}
                currency={baseCurrency}
              />
            ) : (
              "—"
            )
          }
          sublabel={
            snapshot.portfolioGrowth.incomeByYear.length > 0
              ? String(snapshot.portfolioGrowth.incomeByYear.at(-1)!.year)
              : "The current year isn't complete yet"
          }
        />
        <KpiCard
          label="YoY Growth"
          value={
            latestGrowth?.growth ? (
              <Percent value={latestGrowth.growth.toString()} signDisplay="always" />
            ) : (
              "—"
            )
          }
          sublabel={latestGrowth ? `vs ${latestGrowth.year - 1}` : "Needs 2 full years"}
        />
        <KpiCard
          label="CAGR"
          value={
            snapshot.portfolioGrowth.cagr ? (
              <Percent value={snapshot.portfolioGrowth.cagr.toString()} />
            ) : (
              "—"
            )
          }
          sublabel="Across full-year history"
        />
      </div>

      <div className="rounded-lg border p-4">
        <h2 className="mb-4 text-sm font-medium">Monthly Income</h2>
        <MonthlyIncomeChart data={chartData} currency={baseCurrency} />
      </div>

      {snapshot.yieldsBySecurity.size > 0 && (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Security</TableHead>
                <TableHead className="text-right">Current Yield</TableHead>
                <TableHead className="text-right">Yield on Cost</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from(snapshot.yieldsBySecurity.entries()).map(([securityId, y]) => (
                <TableRow key={securityId}>
                  <TableCell>{tickerBySecurityId.get(securityId) ?? securityId}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {y.currentYield ? <Percent value={y.currentYield.toString()} /> : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {y.yieldOnCost ? <Percent value={y.yieldOnCost.toString()} /> : "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Security</TableHead>
              <TableHead className="text-right">Gross</TableHead>
              <TableHead className="text-right">Tax</TableHead>
              <TableHead className="text-right">Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.cashflows
              .slice()
              .reverse()
              .map((cf) => (
                <TableRow key={cf.transactionId}>
                  <TableCell>{formatDate(cf.date)}</TableCell>
                  <TableCell>{tickerBySecurityId.get(cf.securityId) ?? cf.securityId}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Money value={cf.grossAmount.toString()} currency={cf.currency} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Money value={cf.taxes.toString()} currency={cf.currency} />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    <Money value={cf.netAmount.toString()} currency={cf.currency} />
                    {cf.netAmountBase === null && (
                      <Badge variant="secondary" className="ml-2">
                        no FX
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
