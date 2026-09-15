"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TRANSACTION_TYPES } from "@/lib/validation/transaction";
import { TransactionForm } from "./transaction-form";
import type { SelectedSecurity } from "./security-search-field";

export interface EditableTransaction {
  id: string;
  accountId: string;
  type: (typeof TRANSACTION_TYPES)[number];
  date: string;
  quantity: string | null;
  price: string | null;
  amount: string | null;
  fees: string;
  taxes: string;
  currency: string;
  notes: string;
  security: SelectedSecurity | null;
}

interface EditTransactionDialogProps {
  transaction: EditableTransaction | null;
  accounts: { id: string; name: string }[];
  securities: { id: string; ticker: string; name: string; currency: string }[];
  onOpenChange: (open: boolean) => void;
}

/**
 * A single shared dialog for editing whichever transaction the table's
 * "Edit" button was last clicked on — controlled entirely by `transaction`
 * (null closes it) rather than owning its own open state, since it's
 * triggered from a row in `TransactionsTable`, not from a trigger of its
 * own.
 */
export function EditTransactionDialog({
  transaction,
  accounts,
  securities,
  onOpenChange,
}: EditTransactionDialogProps) {
  return (
    <Dialog open={transaction !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit transaction</DialogTitle>
        </DialogHeader>
        {transaction && (
          <TransactionForm
            // Forces the form to remount (fresh defaultValues) when the
            // user closes this dialog and opens it again for a different
            // row — react-hook-form otherwise keeps the previous row's
            // field state.
            key={transaction.id}
            accounts={accounts}
            securities={securities}
            transactionId={transaction.id}
            initialValues={{
              accountId: transaction.accountId,
              securityId: transaction.security?.id ?? null,
              type: transaction.type,
              date: transaction.date,
              quantity: transaction.quantity,
              price: transaction.price,
              amount: transaction.amount,
              fees: transaction.fees,
              taxes: transaction.taxes,
              currency: transaction.currency,
              notes: transaction.notes,
              security: transaction.security,
            }}
            onSuccess={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
