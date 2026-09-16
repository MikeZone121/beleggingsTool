"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money, Percent } from "@/components/ui/money";
import { EditTargetPricePopover } from "./edit-target-price-popover";
import type { WatchlistRow } from "@/lib/portfolio/watchlistService";

interface WatchlistTableProps {
  items: WatchlistRow[];
}

function dayChangeToneClass(value: string | null): string {
  if (!value) return "";
  const n = Number(value);
  if (n > 0) return "text-emerald-600 dark:text-emerald-400";
  if (n < 0) return "text-red-600 dark:text-red-400";
  return "";
}

export function WatchlistTable({ items }: WatchlistTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return items;
    return items.filter(
      (i) => i.ticker.toLowerCase().includes(q) || i.name.toLowerCase().includes(q)
    );
  }, [items, query]);

  function handleRemove(id: string, ticker: string) {
    startTransition(async () => {
      const response = await fetch(`/api/watchlist/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error?.message ?? "Failed to remove from watchlist");
        return;
      }
      toast.success(`${ticker} removed from watchlist`);
      router.refresh();
    });
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm shadow-black/5">
      <div className="flex items-center gap-2 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-56 pl-7"
            placeholder="Search by ticker or name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {query && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {items.length}
          </span>
        )}
      </div>

      <div className="flex flex-col divide-y divide-border md:hidden">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {items.length === 0
              ? "Nothing on your watchlist yet — add a ticker to start tracking it."
              : "No matches."}
          </p>
        )}
        {filtered.map((item) => (
          <div
            key={item.id}
            className={`flex flex-col gap-1 p-3 ${item.targetReached ? "bg-emerald-500/10" : ""}`}
          >
            <div className="flex items-start justify-between gap-2">
              <Link href={`/watchlist/${item.securityId}`} className="min-w-0 hover:underline">
                <div className="font-medium">{item.ticker}</div>
                <div className="truncate text-xs text-muted-foreground">{item.name}</div>
              </Link>
              <div className="flex shrink-0 items-center gap-1">
                <div className="text-right">
                  {item.currentPrice ? (
                    <Money value={item.currentPrice} currency={item.currency} />
                  ) : (
                    <Badge variant="secondary">no price</Badge>
                  )}
                  <div className={`text-xs tabular-nums ${dayChangeToneClass(item.dayChangePercent)}`}>
                    {item.dayChangePercent ? (
                      <Percent value={item.dayChangePercent} signDisplay="always" />
                    ) : (
                      "—"
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove from watchlist"
                  disabled={isPending}
                  onClick={() => handleRemove(item.id, item.ticker)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between gap-1.5 text-xs">
              <span className="text-muted-foreground">
                Target:{" "}
                {item.targetPrice ? (
                  <Money value={item.targetPrice} currency={item.currency} />
                ) : (
                  "—"
                )}
                {item.targetReached && (
                  <Badge className="ml-1.5 bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                    Target reached
                  </Badge>
                )}
              </span>
              <EditTargetPricePopover
                id={item.id}
                ticker={item.ticker}
                currency={item.currency}
                targetPrice={item.targetPrice}
              />
            </div>
          </div>
        ))}
      </div>

      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Security</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Today</TableHead>
            <TableHead className="text-right">Target</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                {items.length === 0
                  ? "Nothing on your watchlist yet — add a ticker to start tracking it."
                  : "No matches."}
              </TableCell>
            </TableRow>
          )}
          {filtered.map((item) => (
            <TableRow
              key={item.id}
              className={item.targetReached ? "bg-emerald-500/10 hover:bg-emerald-500/15" : undefined}
            >
              <TableCell>
                <Link href={`/watchlist/${item.securityId}`} className="block hover:underline">
                  <div className="font-medium">{item.ticker}</div>
                  <div className="text-xs text-muted-foreground">{item.name}</div>
                </Link>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <div className="flex items-center justify-end gap-1">
                  {item.currentPrice ? (
                    <Money value={item.currentPrice} currency={item.currency} />
                  ) : (
                    <Badge variant="secondary">no price</Badge>
                  )}
                  {item.priceStale && item.currentPrice && <Badge variant="secondary">stale</Badge>}
                </div>
              </TableCell>
              <TableCell className={`text-right tabular-nums ${dayChangeToneClass(item.dayChangePercent)}`}>
                {item.dayChangePercent ? (
                  <Percent value={item.dayChangePercent} signDisplay="always" />
                ) : (
                  "—"
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <div className="flex items-center justify-end gap-1.5">
                  {item.targetReached && (
                    <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
                      Target reached
                    </Badge>
                  )}
                  {item.targetPrice ? (
                    <Money value={item.targetPrice} currency={item.currency} />
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                  <EditTargetPricePopover
                    id={item.id}
                    ticker={item.ticker}
                    currency={item.currency}
                    targetPrice={item.targetPrice}
                  />
                </div>
              </TableCell>
              <TableCell>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove from watchlist"
                  disabled={isPending}
                  onClick={() => handleRemove(item.id, item.ticker)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
