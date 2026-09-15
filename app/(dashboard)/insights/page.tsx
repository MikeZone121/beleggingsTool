import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getFinancialDataProvider } from "@/lib/providers/financialData";
import { isClaudeConfigured } from "@/lib/ai/claudeClient";
import { EmptyState } from "@/components/empty-state";
import { InsightsPanel } from "@/components/insights/insights-panel";

export default async function InsightsPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  if (!portfolio) {
    return <EmptyState title="No portfolio yet" description="No default portfolio was found." />;
  }

  const provider = getFinancialDataProvider();
  const providerSupportsNews = typeof (provider as { getNews?: unknown }).getNews === "function";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Insights</h1>
        <p className="text-sm text-muted-foreground">{portfolio.name}</p>
      </div>

      <InsightsPanel aiConfigured={isClaudeConfigured()} providerSupportsNews={providerSupportsNews} />
    </div>
  );
}
