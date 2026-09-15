import Link from "next/link";
import { Upload } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { Button } from "@/components/ui/button";
import { listAccounts } from "@/lib/db/accounts";
import { listSecurities } from "@/lib/db/securities";
import { listPortfolioTransactions } from "@/lib/portfolio/transactionService";
import { EmptyState } from "@/components/empty-state";
import { AddTransactionDialog } from "@/components/transactions/add-transaction-dialog";
import { AddSecurityDialog } from "@/components/securities/add-security-dialog";
import { TransactionsTable, type TransactionRow } from "@/components/transactions/transactions-table";

export default async function TransactionsPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  if (!portfolio) {
    return <EmptyState title="No portfolio yet" description="No default portfolio was found." />;
  }

  const [accounts, securities, transactions] = await Promise.all([
    listAccounts(user.id, portfolio.id),
    listSecurities(),
    listPortfolioTransactions(user.id, portfolio.id),
  ]);

  const accountOptions = accounts.map((a) => ({ id: a.id, name: a.name }));
  const securityOptions = securities.map((s) => ({
    id: s.id,
    ticker: s.ticker,
    name: s.name,
    currency: s.currency,
  }));

  const TYPES_WITH_QUANTITY_PRICE = new Set(["BUY", "SELL"]);
  const rows: TransactionRow[] = transactions
    .slice()
    .reverse()
    .map((tx) => ({
      id: tx.id,
      accountId: tx.accountId,
      type: tx.type,
      date: tx.date.toISOString(),
      securityId: tx.securityId,
      securityTicker: tx.security?.ticker ?? null,
      securityName: tx.security?.name ?? null,
      securityCurrency: tx.security?.currency ?? null,
      quantity: tx.quantity?.toString() ?? null,
      price: tx.price?.toString() ?? null,
      // `amount` has no column of its own (see transactionAmounts.ts) — for
      // every type that uses it, it's exactly `grossAmount`.
      amount: TYPES_WITH_QUANTITY_PRICE.has(tx.type) ? null : tx.grossAmount.toString(),
      grossAmount: tx.grossAmount.toString(),
      fees: tx.fees.toString(),
      taxes: tx.taxes.toString(),
      netAmount: tx.netAmount.toString(),
      currency: tx.currency,
      notes: tx.notes ?? "",
    }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">{portfolio.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" render={<Link href="/transactions/import" />} nativeButton={false}>
            <Upload className="size-4" />
            Import CSV
          </Button>
          <AddSecurityDialog />
          {accounts.length > 0 && (
            <AddTransactionDialog accounts={accountOptions} securities={securityOptions} />
          )}
        </div>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          title="No account yet"
          description="An account is required before you can record transactions."
        />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description="Add your first transaction to start tracking your portfolio."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm shadow-black/5">
          <TransactionsTable
            transactions={rows}
            accounts={accountOptions}
            securities={securityOptions}
          />
        </div>
      )}
    </div>
  );
}
