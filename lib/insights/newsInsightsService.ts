import { getFinancialDataProvider } from "@/lib/providers/financialData";
import type { NewsCapableProvider, NewsHeadline } from "@/lib/providers/financialData";
import { getPortfolioSnapshot } from "@/lib/portfolio/holdingsService";
import { summarizeWithClaude, isClaudeConfigured, ClaudeError } from "@/lib/ai/claudeClient";

export interface HoldingInsight {
  securityId: string;
  ticker: string;
  name: string;
  headlines: NewsHeadline[];
  summary: string | null;
  error: string | null;
}

export interface InsightsResult {
  aiConfigured: boolean;
  providerSupportsNews: boolean;
  insights: HoldingInsight[];
}

function isNewsCapable(provider: object): provider is NewsCapableProvider {
  return typeof (provider as Partial<NewsCapableProvider>).getNews === "function";
}

/**
 * Deliberately instructs against advice/predictions/opinions, and against
 * inventing detail the headlines don't support — this is a summarization
 * aid for "what's been in the news", never a recommendation engine.
 */
function buildPrompt(name: string, ticker: string, headlines: NewsHeadline[]): string {
  const list = headlines
    .map((h) => `- "${h.title}" — ${h.publisher}, ${h.publishedAt.toDateString()}`)
    .join("\n");

  return `You are summarizing recent news headlines about a publicly traded company for a personal investment-tracking app. The user holds shares of ${name} (${ticker}).

Recent headlines:
${list}

Write a short, neutral, factual summary (2-3 sentences) of what these headlines suggest has been happening recently. Base it only on the headlines above — do not invent details they don't support. Do NOT give investment advice, a price prediction, or a buy/sell/hold opinion; this is informational only. If the headlines are too thin, unrelated to the company's actual business, or purely tangential market chatter, say so briefly instead of overstating their significance.`;
}

/**
 * One news-summary pass per currently-held security: fetch a handful of
 * recent headlines from the market-data provider (only if it implements
 * `NewsCapableProvider` — Yahoo does, Twelve Data/manual don't), then ask
 * Claude for a short, neutral, advice-free summary. Runs sequentially and
 * tolerates a single holding's failure (missing news, a Claude API error)
 * without failing the whole batch — see `error` on each row.
 *
 * Both "no news provider" and "no ANTHROPIC_API_KEY" degrade gracefully
 * (empty headlines / null summary) rather than throwing, matching the
 * `manual` financial-data provider's "no-op, not an error" pattern.
 */
export async function getHoldingInsights(
  userId: string,
  portfolioId: string
): Promise<InsightsResult> {
  const provider = getFinancialDataProvider();
  const aiConfigured = isClaudeConfigured();
  const providerSupportsNews = isNewsCapable(provider);

  const snapshot = await getPortfolioSnapshot(userId, portfolioId);
  const held = snapshot.holdings.filter((h) => h.quantity.greaterThan(0));

  const insights: HoldingInsight[] = [];
  for (const holding of held) {
    let headlines: NewsHeadline[] = [];
    if (providerSupportsNews) {
      try {
        headlines = await provider.getNews(holding.ticker, 5);
      } catch {
        headlines = [];
      }
    }

    let summary: string | null = null;
    let error: string | null = null;
    if (aiConfigured && headlines.length > 0) {
      try {
        summary = await summarizeWithClaude(buildPrompt(holding.name, holding.ticker, headlines));
      } catch (e) {
        error = e instanceof ClaudeError ? e.message : "Failed to generate summary";
      }
    }

    insights.push({
      securityId: holding.securityId,
      ticker: holding.ticker,
      name: holding.name,
      headlines,
      summary,
      error,
    });
  }

  return { aiConfigured, providerSupportsNews, insights };
}
