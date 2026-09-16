import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { listSecurities } from "@/lib/db/securities";
import { getDividendSnapshot, getDividendCalendar } from "@/lib/dividends/dividendService";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/empty-state";
import { MonthlyIncomeChart } from "@/components/charts/monthly-income-chart";
import { AnnualIncomeChart } from "@/components/charts/annual-income-chart";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Money, Percent } from "@/components/ui/money";
import { DividendCalendar } from "@/components/dividends/dividend-calendar";
import { SyncDividendsButton } from "@/components/dividends/sync-dividends-button";
import { PaymentHistoryTable, type PaymentHistoryRow } from "@/components/dividends/payment-history-table";
import { Button } from "@/components/ui/button";
import { CalendarPlus } from "lucide-react";

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

  const [snapshot, securities, calendarRows] = await Promise.all([
    getDividendSnapshot(user.id, portfolio.id),
    listSecurities(),
    getDividendCalendar(user.id, portfolio.id),
  ]);
  const { baseCurrency } = snapshot;
  const tickerBySecurityId = new Map(securities.map((s) => [s.id, s.ticker]));

  const calendarData = calendarRows.map((row) => ({
    securityId: row.securityId,
    ticker: row.ticker,
    name: row.name,
    currency: row.currency,
    quantity: row.quantity.toString(),
    lastExDate: row.estimate.lastExDate.toISOString(),
    lastAmountPerShare: row.estimate.lastAmountPerShare.toString(),
    estimatedNextExDate: row.estimate.estimatedNextExDate.toISOString(),
    estimatedAmountPerShare: row.estimate.estimatedAmountPerShare.toString(),
    estimatedIntervalDays: row.estimate.estimatedIntervalDays,
    paymentsOnRecord: row.estimate.paymentsOnRecord,
    grossBase: row.payout.grossBase?.toString() ?? null,
    taxBase: row.payout.taxBase?.toString() ?? null,
    netBase: row.payout.netBase?.toString() ?? null,
  }));

  if (snapshot.cashflows.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold">Dividends</h1>
          <div className="flex items-center gap-2">
            {calendarData.length > 0 && (
              <Button variant="outline" render={<a href="/api/dividends/ics" download />} nativeButton={false}>
                <CalendarPlus className="size-4" />
                Export to Calendar
              </Button>
            )}
            <SyncDividendsButton />
          </div>
        </div>
        <DividendCalendar rows={calendarData} baseCurrency={baseCurrency} />
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
  const growthByYear = new Map(snapshot.portfolioGrowth.yoyGrowth.map((g) => [g.year, g.growth]));
  const annualIncomeData = snapshot.portfolioGrowth.incomeByYear.map((y) => ({
    year: y.year,
    income: y.income.toNumber(),
    growth: growthByYear.get(y.year)?.toNumber() ?? null,
  }));

  const paymentHistoryRows: PaymentHistoryRow[] = snapshot.cashflows
    .slice()
    .reverse()
    .map((cf) => ({
      transactionId: cf.transactionId,
      date: cf.date.toISOString(),
      ticker: tickerBySecurityId.get(cf.securityId) ?? cf.securityId,
      currency: cf.currency,
      grossAmount: cf.grossAmount.toString(),
      taxes: cf.taxes.toString(),
      netAmount: cf.netAmount.toString(),
      missingFx: cf.netAmountBase === null,
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dividends</h1>
          <p className="text-sm text-muted-foreground">{portfolio.name}</p>
        </div>
        <div className="flex items-center gap-2">
          {calendarData.length > 0 && (
            <Button variant="outline" render={<a href="/api/dividends/ics" download />} nativeButton={false}>
              <CalendarPlus className="size-4" />
              Export to Calendar
            </Button>
          )}
          <SyncDividendsButton />
        </div>
      </div>

      <DividendCalendar rows={calendarData} baseCurrency={baseCurrency} />

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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Monthly Income</CardTitle>
        </CardHeader>
        <CardContent>
          <MonthlyIncomeChart data={chartData} currency={baseCurrency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Annual Income Growth</CardTitle>
        </CardHeader>
        <CardContent>
          <AnnualIncomeChart data={annualIncomeData} currency={baseCurrency} />
        </CardContent>
      </Card>

      {snapshot.yieldsBySecurity.size > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Yield by Holding</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm shadow-black/5">
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
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Payment History</h2>
        <PaymentHistoryTable rows={paymentHistoryRows} />
      </div>
    </div>
  );
}
