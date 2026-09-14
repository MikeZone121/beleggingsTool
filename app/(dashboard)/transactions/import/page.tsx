import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { listAccounts } from "@/lib/db/accounts";
import { EmptyState } from "@/components/empty-state";
import { ImportWizard } from "@/components/import/import-wizard";

export default async function ImportPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  if (!portfolio) {
    return <EmptyState title="No portfolio yet" description="No default portfolio was found." />;
  }

  const accounts = await listAccounts(user.id, portfolio.id);
  if (accounts.length === 0) {
    return (
      <EmptyState
        title="No account yet"
        description="An account is required before you can import transactions."
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Import Transactions</h1>
        <p className="text-sm text-muted-foreground">
          Upload a CSV export from your broker and map its columns to import transactions.
        </p>
      </div>
      <ImportWizard accounts={accounts.map((a) => ({ id: a.id, name: a.name }))} />
    </div>
  );
}
