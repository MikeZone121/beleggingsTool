import Decimal from "decimal.js";
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
import { Money, Quantity } from "@/components/ui/money";

export interface DividendCalendarRowData {
  securityId: string;
  ticker: string;
  name: string;
  currency: string;
  quantity: string;
  lastExDate: string;
  lastAmountPerShare: string;
  estimatedNextExDate: string;
  estimatedAmountPerShare: string;
  estimatedIntervalDays: number;
  paymentsOnRecord: number;
  grossBase: string | null;
  taxBase: string | null;
  netBase: string | null;
}

export function DividendCalendar({
  rows,
  baseCurrency,
}: {
  rows: DividendCalendarRowData[];
  baseCurrency: string;
}) {
  if (rows.length === 0) return null;

  const totalNetBase = rows.reduce(
    (sum, r) => (r.netBase ? sum.plus(r.netBase) : sum),
    new Decimal(0)
  );
  const anyMissingFx = rows.some((r) => r.netBase === null);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Upcoming (estimated)</h2>
        <p className="text-xs text-muted-foreground">
          Projected from each security&apos;s own payment history — not a confirmed date. Net
          assumes the flat 30% Belgian withholding tax (roerende voorheffing); it doesn&apos;t
          account for the annual tax-free allowance or foreign withholding already deducted
          abroad, so treat it as a lower-bound estimate.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm shadow-black/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Security</TableHead>
              <TableHead>Est. next ex-date</TableHead>
              <TableHead className="text-right">Qty held</TableHead>
              <TableHead className="text-right">Est. gross</TableHead>
              <TableHead className="text-right">BE tax (30%)</TableHead>
              <TableHead className="text-right">Est. net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.securityId}>
                <TableCell>
                  <div className="font-medium">{row.ticker}</div>
                  <div className="text-xs text-muted-foreground">{row.name}</div>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  <div className="flex items-center gap-1.5">
                    {formatDate(row.estimatedNextExDate)}
                    <Badge variant="secondary">estimated</Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Last paid {formatDate(row.lastExDate)} (
                    <Money value={row.lastAmountPerShare} currency={row.currency} />
                    /share) · {row.paymentsOnRecord} payment{row.paymentsOnRecord === 1 ? "" : "s"}
                    , ~{row.estimatedIntervalDays}d cadence
                  </div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Quantity value={row.quantity} />
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.grossBase ? (
                    <Money value={row.grossBase} currency={baseCurrency} />
                  ) : (
                    <Badge variant="secondary">no FX</Badge>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.taxBase ? (
                    <>
                      -<Money value={row.taxBase} currency={baseCurrency} />
                    </>
                  ) : (
                    "—"
                  )}
                </TableCell>
                <TableCell className="text-right font-medium tabular-nums">
                  {row.netBase ? <Money value={row.netBase} currency={baseCurrency} /> : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <p className="px-1 text-right text-sm">
        <span className="text-muted-foreground">Total estimated net across upcoming payouts: </span>
        <span className="font-medium">
          <Money value={totalNetBase.toString()} currency={baseCurrency} />
        </span>
        {anyMissingFx && (
          <span className="ml-1.5 text-xs text-muted-foreground">(excludes rows missing FX)</span>
        )}
      </p>
    </div>
  );
}
