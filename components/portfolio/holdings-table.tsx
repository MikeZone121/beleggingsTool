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
import { Money, Percent, Quantity } from "@/components/ui/money";
import { EditPricePopover } from "@/components/securities/edit-price-popover";

export interface HoldingRow {
  securityId: string;
  ticker: string;
  name: string;
  currency: string;
  quantity: string;
  averageCost: string;
  /** Trailing-12-month dividends / cost basis — "what you get back per
   * year, as a % of what you paid". Null with no dividend history yet. */
  yieldOnCost: string | null;
  currentPrice: string | null;
  priceStale: boolean;
  /** vs. the most recent prior trading day's close, whichever market
   * (EU/US/CA) the security trades on. Null when there's no prior close
   * to compare against yet. */
  dayChangePercent: string | null;
  marketValueBase: string | null;
  weight: string | null;
  unrealizedPnLBase: string | null;
  returnPercent: string | null;
  tone: "positive" | "negative" | "neutral";
}

export interface CashRowData {
  baseCurrency: string;
  balanceBase: string;
  weight: string | null;
}

interface HoldingsTableProps {
  holdings: HoldingRow[];
  cash: CashRowData | null;
  baseCurrency: string;
}

const toneClass: Record<HoldingRow["tone"], string> = {
  positive: "text-emerald-600 dark:text-emerald-400",
  negative: "text-red-600 dark:text-red-400",
  neutral: "",
};

function dayChangeToneClass(value: string | null): string {
  if (!value) return "";
  const n = Number(value);
  if (n > 0) return "text-emerald-600 dark:text-emerald-400";
  if (n < 0) return "text-red-600 dark:text-red-400";
  return "";
}

export function HoldingsTable({ holdings, cash, baseCurrency }: HoldingsTableProps) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "") return holdings;
    return holdings.filter(
      (h) => h.ticker.toLowerCase().includes(q) || h.name.toLowerCase().includes(q)
    );
  }, [holdings, query]);

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
            {filtered.length} of {holdings.length}
          </span>
        )}
      </div>

      {/* Nine columns doesn't fit a phone screen — a stacked card per
       * holding below the md breakpoint instead, same pattern as the
       * Transactions list. */}
      <div className="flex flex-col divide-y divide-border md:hidden">
        {filtered.length === 0 && !cash && (
          <p className="py-6 text-center text-sm text-muted-foreground">No holdings match your search.</p>
        )}
        {filtered.map((holding) => (
          <div key={holding.securityId} className="flex flex-col gap-1 p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-medium">{holding.ticker}</div>
                <div className="truncate text-xs text-muted-foreground">{holding.name}</div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-medium tabular-nums">
                  <Money value={holding.marketValueBase} currency={baseCurrency} />
                </div>
                {holding.weight && (
                  <div className="text-xs tabular-nums text-muted-foreground">
                    <Percent value={holding.weight} />
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <div className="min-w-0 text-muted-foreground">
                <Quantity value={holding.quantity} />
                {" @ "}
                {holding.currentPrice ? (
                  <span className={dayChangeToneClass(holding.dayChangePercent)}>
                    <Money value={holding.currentPrice} currency={holding.currency} />
                  </span>
                ) : (
                  <Badge variant="secondary">no price</Badge>
                )}
                {holding.dayChangePercent && (
                  <span className={dayChangeToneClass(holding.dayChangePercent)}>
                    {" "}
                    (<Percent value={holding.dayChangePercent} signDisplay="always" />)
                  </span>
                )}
              </div>
              <div className={`shrink-0 text-right tabular-nums font-medium ${toneClass[holding.tone]}`}>
                <Money value={holding.unrealizedPnLBase} currency={baseCurrency} signDisplay="always" />
                {holding.returnPercent && (
                  <span className="ml-1 text-xs">
                    (<Percent value={holding.returnPercent} signDisplay="always" />)
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
        {cash && (
          <div className="flex items-center justify-between gap-2 bg-muted/40 p-3">
            <div>
              <div className="font-medium">Cash</div>
              <div className="text-xs text-muted-foreground">{cash.baseCurrency} balance</div>
            </div>
            <div className="text-right">
              <div className="font-medium tabular-nums">
                <Money value={cash.balanceBase} currency={cash.baseCurrency} />
              </div>
              {cash.weight && (
                <div className="text-xs tabular-nums text-muted-foreground">
                  <Percent value={cash.weight} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <Table className="hidden md:table">
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
          {filtered.length === 0 && !cash && (
            <TableRow>
              <TableCell colSpan={8} className="py-6 text-center text-sm text-muted-foreground">
                No holdings match your search.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((holding) => (
            <TableRow key={holding.securityId}>
              <TableCell>
                <div className="font-medium">{holding.ticker}</div>
                <div className="text-xs text-muted-foreground">{holding.name}</div>
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <Quantity value={holding.quantity} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={holding.averageCost} currency={holding.currency} />
                {holding.yieldOnCost && (
                  <div className="text-xs text-muted-foreground">
                    <Percent value={holding.yieldOnCost} /> yield
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <div className="flex items-center justify-end gap-1">
                  {holding.currentPrice ? (
                    <span className={dayChangeToneClass(holding.dayChangePercent)}>
                      <Money value={holding.currentPrice} currency={holding.currency} />
                    </span>
                  ) : (
                    <Badge variant="secondary">no price</Badge>
                  )}
                  {holding.priceStale && holding.currentPrice && (
                    <Badge variant="secondary">stale</Badge>
                  )}
                  <EditPricePopover
                    securityId={holding.securityId}
                    ticker={holding.ticker}
                    currency={holding.currency}
                    currentPrice={holding.currentPrice}
                  />
                </div>
                {holding.dayChangePercent && (
                  <div className={`text-xs ${dayChangeToneClass(holding.dayChangePercent)}`}>
                    <Percent value={holding.dayChangePercent} signDisplay="always" /> today
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={holding.marketValueBase} currency={baseCurrency} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {holding.weight ? <Percent value={holding.weight} /> : "—"}
              </TableCell>
              <TableCell className={`text-right tabular-nums ${toneClass[holding.tone]}`}>
                <Money
                  value={holding.unrealizedPnLBase}
                  currency={baseCurrency}
                  signDisplay="always"
                />
              </TableCell>
              <TableCell className={`text-right tabular-nums ${toneClass[holding.tone]}`}>
                {holding.returnPercent ? (
                  <Percent value={holding.returnPercent} signDisplay="always" />
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
          {/* Cash isn't a security — it has no quantity, price, or P&L — so
           * it goes last rather than sorted in among holdings by value,
           * matching how brokerage statements (Schwab, DEGIRO, IBKR) list
           * it as its own trailing line rather than a position. A muted
           * background keeps that distinction visible at a glance. */}
          {cash && (
            <TableRow className="bg-muted/40">
              <TableCell>
                <div className="font-medium">Cash</div>
                <div className="text-xs text-muted-foreground">{cash.baseCurrency} balance</div>
              </TableCell>
              <TableCell className="text-right tabular-nums">—</TableCell>
              <TableCell className="text-right tabular-nums">—</TableCell>
              <TableCell className="text-right tabular-nums">—</TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={cash.balanceBase} currency={cash.baseCurrency} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {cash.weight ? <Percent value={cash.weight} /> : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">—</TableCell>
              <TableCell className="text-right tabular-nums">—</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
