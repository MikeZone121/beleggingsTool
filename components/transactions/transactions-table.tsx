"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
import { formatDate } from "@/lib/utils/format";
import { Money, Quantity } from "@/components/ui/money";
import { EditTransactionDialog, type EditableTransaction } from "./edit-transaction-dialog";
import { TRANSACTION_TYPES } from "@/lib/validation/transaction";

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
      <Table>
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
          {transactions.map((tx) => (
            <TableRow key={tx.id}>
              <TableCell className="whitespace-nowrap">{formatDate(tx.date)}</TableCell>
              <TableCell>
                <Badge variant="outline">{tx.type}</Badge>
                {tx.notes && (
                  <div
                    className="mt-1 max-w-[240px] truncate text-xs text-muted-foreground"
                    title={tx.notes}
                  >
                    {tx.notes}
                  </div>
                )}
              </TableCell>
              <TableCell>{tx.securityTicker ?? "—"}</TableCell>
              <TableCell className="text-right tabular-nums">
                {tx.quantity ? <Quantity value={tx.quantity} /> : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {tx.price ? <Money value={tx.price} currency={tx.currency} /> : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                <Money value={tx.netAmount} currency={tx.currency} />
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
          ))}
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
