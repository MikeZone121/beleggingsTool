"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Money } from "@/components/ui/money";
import { formatRelativeTime } from "@/lib/utils/format";
import { useLocale } from "@/components/locale-provider";
import { EditSecurityDialog, type EditableSecurity } from "./edit-security-dialog";

export interface SecurityRow {
  id: string;
  ticker: string;
  name: string;
  assetType: EditableSecurity["assetType"];
  exchange: string | null;
  currency: string;
  isin: string | null;
  country: string | null;
  sector: string | null;
  currentPrice: string | null;
  priceUpdatedAt: string | null;
  /** How many transactions reference this security — a security with any
   * can't be deleted (see `deleteSecurity`), so the row says why. */
  transactionCount: number;
}

function toEditable(row: SecurityRow): EditableSecurity {
  return {
    id: row.id,
    ticker: row.ticker,
    name: row.name,
    assetType: row.assetType,
    exchange: row.exchange ?? "",
    currency: row.currency,
    isin: row.isin ?? "",
    country: row.country ?? "",
    sector: row.sector ?? "",
    currentPrice: row.currentPrice ?? "",
  };
}

export function SecuritiesTable({ securities }: { securities: SecurityRow[] }) {
  const router = useRouter();
  const locale = useLocale();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<EditableSecurity | null>(null);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return securities;
    return securities.filter(
      (s) =>
        s.ticker.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        (s.isin?.toLowerCase().includes(q) ?? false)
    );
  }, [securities, query]);

  function handleDelete(row: SecurityRow) {
    startTransition(async () => {
      const response = await fetch(`/api/securities/${row.id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error?.message ?? "Failed to delete security");
        return;
      }
      toast.success(`${row.ticker} deleted`);
      router.refresh();
    });
  }

  /** Why the delete button is disabled, as a `title` — a disabled button
   * with no explanation is the most common way this kind of guard reads
   * as "broken" rather than "deliberate". */
  function deleteHint(row: SecurityRow): string | undefined {
    if (row.transactionCount === 0) return undefined;
    return `Used by ${row.transactionCount} transaction${row.transactionCount === 1 ? "" : "s"} — delete those first`;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm shadow-black/5">
        <div className="flex items-center gap-2 border-b border-border p-3">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-8 w-56 pl-7"
              placeholder="Search by ticker, name, or ISIN…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {query && (
            <span className="text-xs text-muted-foreground">
              {filtered.length} of {securities.length}
            </span>
          )}
        </div>

        {/* Same stacked-card-below-md pattern as the Holdings and
         * Transactions tables. */}
        <div className="flex flex-col divide-y divide-border md:hidden">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No securities match your search.
            </p>
          )}
          {filtered.map((row) => (
            <div key={row.id} className="flex flex-col gap-1 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium">{row.ticker}</div>
                  <div className="truncate text-xs text-muted-foreground">{row.name}</div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-9"
                    aria-label={`Edit ${row.ticker}`}
                    onClick={() => setEditing(toEditable(row))}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="size-9"
                    aria-label={`Delete ${row.ticker}`}
                    title={deleteHint(row)}
                    disabled={isPending || row.transactionCount > 0}
                    onClick={() => handleDelete(row)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="text-muted-foreground">
                  {row.assetType} · {row.exchange ?? "—"} · {row.currency}
                </span>
                <span className="tabular-nums">
                  {row.currentPrice ? (
                    <Money value={row.currentPrice} currency={row.currency} />
                  ) : (
                    <Badge variant="secondary">no price</Badge>
                  )}
                </span>
              </div>
              <div className="text-xs text-muted-foreground">
                {row.transactionCount} transaction{row.transactionCount === 1 ? "" : "s"}
                {row.priceUpdatedAt &&
                  ` · priced ${formatRelativeTime(row.priceUpdatedAt, { locale })}`}
              </div>
            </div>
          ))}
        </div>

        <Table className="hidden md:table">
          <TableHeader>
            <TableRow>
              <TableHead>Security</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Exchange</TableHead>
              <TableHead className="text-right">Current price</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                  No securities match your search.
                </TableCell>
              </TableRow>
            )}
            {filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{row.ticker}</div>
                  <div className="text-xs text-muted-foreground">
                    {row.name}
                    {row.isin && ` · ${row.isin}`}
                  </div>
                </TableCell>
                <TableCell>{row.assetType}</TableCell>
                <TableCell>
                  {row.exchange ?? "—"}
                  <div className="text-xs text-muted-foreground">{row.currency}</div>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.currentPrice ? (
                    <Money value={row.currentPrice} currency={row.currency} />
                  ) : (
                    <Badge variant="secondary">no price</Badge>
                  )}
                  {row.priceUpdatedAt && (
                    <div className="text-xs text-muted-foreground">
                      {formatRelativeTime(row.priceUpdatedAt, { locale })}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">{row.transactionCount}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${row.ticker}`}
                      onClick={() => setEditing(toEditable(row))}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${row.ticker}`}
                      title={deleteHint(row)}
                      disabled={isPending || row.transactionCount > 0}
                      onClick={() => handleDelete(row)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditSecurityDialog security={editing} onClose={() => setEditing(null)} />
    </>
  );
}
