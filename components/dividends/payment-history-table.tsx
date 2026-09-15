"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
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

export interface PaymentHistoryRow {
  transactionId: string;
  date: string;
  ticker: string;
  currency: string;
  grossAmount: string;
  taxes: string;
  netAmount: string;
  missingFx: boolean;
}

export function PaymentHistoryTable({ rows }: { rows: PaymentHistoryRow[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return rows;
    return rows.filter((r) => r.ticker.toLowerCase().includes(q));
  }, [rows, query]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm shadow-black/5">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-56 pl-7"
            placeholder="Search by ticker…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {query && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {rows.length}
          </span>
        )}
      </div>
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
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                No payments match your search.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((row) => (
            <TableRow key={row.transactionId}>
              <TableCell>{formatDate(row.date)}</TableCell>
              <TableCell>{row.ticker}</TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={row.grossAmount} currency={row.currency} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={row.taxes} currency={row.currency} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={row.netAmount} currency={row.currency} />
                {row.missingFx && (
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
  );
}
