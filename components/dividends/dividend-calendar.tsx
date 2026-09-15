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
import { Money } from "@/components/ui/money";

export interface DividendCalendarRowData {
  securityId: string;
  ticker: string;
  name: string;
  currency: string;
  lastExDate: string;
  lastAmountPerShare: string;
  estimatedNextExDate: string;
  estimatedAmountPerShare: string;
  estimatedIntervalDays: number;
  paymentsOnRecord: number;
}

export function DividendCalendar({ rows }: { rows: DividendCalendarRowData[] }) {
  if (rows.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Upcoming (estimated)</h2>
        <p className="text-xs text-muted-foreground">
          Projected from each security&apos;s own payment history — not a confirmed date.
        </p>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm shadow-black/5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Security</TableHead>
              <TableHead>Last paid</TableHead>
              <TableHead>Est. next ex-date</TableHead>
              <TableHead className="text-right">Est. amount/share</TableHead>
              <TableHead className="text-right">Based on</TableHead>
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
                  {formatDate(row.lastExDate)}
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    (<Money value={row.lastAmountPerShare} currency={row.currency} />)
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap tabular-nums">
                  {formatDate(row.estimatedNextExDate)}
                  <Badge variant="secondary" className="ml-1.5">
                    estimated
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <Money value={row.estimatedAmountPerShare} currency={row.currency} />
                </TableCell>
                <TableCell className="text-right text-xs text-muted-foreground tabular-nums">
                  {row.paymentsOnRecord} payment{row.paymentsOnRecord === 1 ? "" : "s"}, ~
                  {row.estimatedIntervalDays}d cadence
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
