"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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

export interface TransactionRow {
  id: string;
  type: string;
  date: string;
  securityTicker: string | null;
  quantity: string | null;
  price: string | null;
  grossAmount: string;
  fees: string;
  taxes: string;
  netAmount: string;
  currency: string;
}

export function TransactionsTable({ transactions }: { transactions: TransactionRow[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Delete transaction"
                disabled={isPending}
                onClick={() => handleDelete(tx.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
