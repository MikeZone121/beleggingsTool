"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowDownCircle,
  ArrowRightLeft,
  ArrowUpCircle,
  Coins,
  FileText,
  GitBranch,
  HelpCircle,
  Pencil,
  Percent as PercentIcon,
  Receipt,
  Search,
  ShoppingCart,
  Trash2,
  TrendingDown,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CASH_IMPACT_SIGN } from "@/lib/finance/cashBalance";
import { EditTransactionDialog, type EditableTransaction } from "./edit-transaction-dialog";
import { TRANSACTION_TYPES } from "@/lib/validation/transaction";

type TxType = (typeof TRANSACTION_TYPES)[number];

/** One icon per type, for faster visual scanning down a long list — this
 * is what carries "what kind of row is this" (a bank-statement pattern:
 * Revolut/N26/Wise all lead each row with a colored icon "avatar" rather
 * than a text label). The *color* of that avatar is the separate,
 * semantic "good/bad" signal, driven by `CASH_IMPACT_SIGN` below — so the
 * two together read as "a dividend (icon) that paid me (green)" at a
 * glance, without parsing the type name in each row. */
const TYPE_ICON: Record<TxType, LucideIcon> = {
  BUY: ShoppingCart,
  SELL: TrendingDown,
  DIVIDEND: Coins,
  DEPOSIT: ArrowDownCircle,
  WITHDRAWAL: ArrowUpCircle,
  FEE: Receipt,
  TAX: FileText,
  INTEREST: PercentIcon,
  TRANSFER: ArrowRightLeft,
  SPLIT: GitBranch,
  OTHER: HelpCircle,
};

const TYPE_LABEL: Record<TxType, string> = {
  BUY: "Buy",
  SELL: "Sell",
  DIVIDEND: "Dividend",
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  FEE: "Fee",
  TAX: "Tax",
  INTEREST: "Interest",
  TRANSFER: "Transfer",
  SPLIT: "Split",
  OTHER: "Other",
};

/** Avatar background/icon tone per cash direction — same 1/-1/undefined
 * split as `amountToneClass` below, so the icon and the amount always
 * agree about which way a row moved cash. */
const ICON_TONE: Record<"in" | "out" | "neutral", string> = {
  in: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400",
  out: "bg-red-100 text-red-600 dark:bg-red-500/15 dark:text-red-400",
  neutral: "bg-muted text-muted-foreground",
};

function iconTone(sign: 1 | -1 | undefined): string {
  return sign === 1 ? ICON_TONE.in : sign === -1 ? ICON_TONE.out : ICON_TONE.neutral;
}

function pnlToneClass(value: string | null): string {
  if (!value) return "";
  const n = Number(value);
  if (n > 0) return "text-emerald-600 dark:text-emerald-400";
  if (n < 0) return "text-red-600 dark:text-red-400";
  return "text-muted-foreground";
}

export interface TransactionRow {
  id: string;
  accountId: string;
  type: (typeof TRANSACTION_TYPES)[number];
  date: string;
  securityId: string | null;
  securityTicker: string | null;
  securityName: string | null;
  securityCurrency: string | null;
  quantity: string | null;
  price: string | null;
  amount: string | null;
  grossAmount: string;
  fees: string;
  taxes: string;
  netAmount: string;
  currency: string;
  notes: string;
  /** Realized gain/loss on a SELL, in the transaction's own currency —
   * proceeds minus the average cost basis of the shares sold. Null for
   * every other type, and for a SELL predating any BUY history. */
  realizedPnL: string | null;
}

interface TransactionsTableProps {
  transactions: TransactionRow[];
  accounts: { id: string; name: string }[];
  securities: { id: string; ticker: string; name: string; currency: string }[];
}

export function TransactionsTable({ transactions, accounts, securities }: TransactionsTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<EditableTransaction | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((tx) => {
      if (typeFilter !== "ALL" && tx.type !== typeFilter) return false;
      if (q === "") return true;
      return (
        (tx.securityTicker?.toLowerCase().includes(q) ?? false) ||
        (tx.securityName?.toLowerCase().includes(q) ?? false) ||
        tx.notes.toLowerCase().includes(q)
      );
    });
  }, [transactions, query, typeFilter]);

  function handleEdit(tx: TransactionRow) {
    setEditing({
      id: tx.id,
      accountId: tx.accountId,
      type: tx.type,
      date: tx.date.slice(0, 10),
      quantity: tx.quantity,
      price: tx.price,
      amount: tx.amount,
      fees: tx.fees,
      taxes: tx.taxes,
      currency: tx.currency,
      notes: tx.notes,
      security:
        tx.securityId && tx.securityTicker && tx.securityCurrency
          ? {
              id: tx.securityId,
              ticker: tx.securityTicker,
              name: tx.securityName ?? tx.securityTicker,
              currency: tx.securityCurrency,
            }
          : null,
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error?.message ?? "Failed to delete transaction");
        return;
      }
      toast.success("Transaction deleted");
      router.refresh();
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-8 w-56 pl-7"
            placeholder="Search by ticker, name, or note…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="ALL">All types</option>
          {TRANSACTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        {(query || typeFilter !== "ALL") && (
          <span className="text-xs text-muted-foreground">
            {filtered.length} of {transactions.length}
          </span>
        )}
      </div>

      {/* Seven columns doesn't fit a phone screen without horizontal
       * scrolling, which is an awkward way to read a transaction list —
       * a stacked card per row (same bank-statement pattern as the icon
       * avatars) reads far better below the `md` breakpoint. */}
      <div className="flex flex-col divide-y divide-border md:hidden">
        {filtered.length === 0 && (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No transactions match your filters.
          </p>
        )}
        {filtered.map((tx) => {
          const Icon = TYPE_ICON[tx.type];
          const sign = CASH_IMPACT_SIGN[tx.type];
          const amountToneClass =
            sign === 1
              ? "text-emerald-600 dark:text-emerald-400"
              : sign === -1
                ? "text-red-600 dark:text-red-400"
                : "";
          const signedNetAmount =
            sign !== undefined ? `${sign === -1 ? "-" : ""}${tx.netAmount}` : tx.netAmount;

          return (
            <div key={tx.id} className="flex flex-col gap-2 p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div
                    className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconTone(sign)}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium">{TYPE_LABEL[tx.type]}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatDate(tx.date)}
                      {tx.securityTicker && ` · ${tx.securityTicker}`}
                    </div>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit transaction"
                    disabled={isPending}
                    onClick={() => handleEdit(tx)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete transaction"
                    disabled={isPending}
                    onClick={() => handleDelete(tx.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>

              <div className="flex items-end justify-between gap-2">
                <div className="text-xs text-muted-foreground">
                  {tx.quantity && (
                    <>
                      <Quantity value={tx.quantity} />
                      {tx.price && (
                        <>
                          {" @ "}
                          <Money value={tx.price} currency={tx.currency} />
                        </>
                      )}
                    </>
                  )}
                  {tx.notes && <div className="mt-0.5 truncate">{tx.notes}</div>}
                </div>
                <div className={`text-right tabular-nums font-medium ${amountToneClass}`}>
                  <Money value={signedNetAmount} currency={tx.currency} signDisplay="always" />
                  {tx.realizedPnL && (
                    <div className={`text-xs font-normal ${pnlToneClass(tx.realizedPnL)}`}>
                      <Money value={tx.realizedPnL} currency={tx.currency} signDisplay="always" /> gain/loss
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <Table className="hidden md:table">
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Security</TableHead>
            <TableHead className="text-right">Quantity</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Net Amount</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                No transactions match your filters.
              </TableCell>
            </TableRow>
          )}
          {filtered.map((tx) => {
            const Icon = TYPE_ICON[tx.type];
            const sign = CASH_IMPACT_SIGN[tx.type];
            const amountToneClass =
              sign === 1
                ? "text-emerald-600 dark:text-emerald-400"
                : sign === -1
                  ? "text-red-600 dark:text-red-400"
                  : "";
            const signedNetAmount =
              sign !== undefined ? `${sign === -1 ? "-" : ""}${tx.netAmount}` : tx.netAmount;

            return (
              <TableRow key={tx.id}>
                <TableCell className="whitespace-nowrap">{formatDate(tx.date)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full ${iconTone(sign)}`}
                    >
                      <Icon className="size-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{TYPE_LABEL[tx.type]}</div>
                      {tx.notes && (
                        <div
                          className="max-w-[220px] truncate text-xs text-muted-foreground"
                          title={tx.notes}
                        >
                          {tx.notes}
                        </div>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>{tx.securityTicker ?? "—"}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {tx.quantity ? <Quantity value={tx.quantity} /> : "—"}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {tx.price ? <Money value={tx.price} currency={tx.currency} /> : "—"}
                </TableCell>
                <TableCell className={`text-right tabular-nums font-medium ${amountToneClass}`}>
                  <Money value={signedNetAmount} currency={tx.currency} signDisplay="always" />
                  {tx.realizedPnL && (
                    <div className={`text-xs font-normal ${pnlToneClass(tx.realizedPnL)}`}>
                      <Money value={tx.realizedPnL} currency={tx.currency} signDisplay="always" /> gain/loss
                    </div>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Edit transaction"
                      disabled={isPending}
                      onClick={() => handleEdit(tx)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Delete transaction"
                      disabled={isPending}
                      onClick={() => handleDelete(tx.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <EditTransactionDialog
        transaction={editing}
        accounts={accounts}
        securities={securities}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      />
    </>
  );
}
