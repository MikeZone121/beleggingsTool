import { Info, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { BehavioralInsight } from "@/lib/finance/behavioralInsights";

interface QuickInsightsCardProps {
  insights: BehavioralInsight[];
}

const TONE_ICON = { info: Info, caution: TriangleAlert };
const TONE_CLASS = {
  info: "text-muted-foreground",
  caution: "text-amber-600 dark:text-amber-400",
};

/**
 * Free, instant, rule-based observations — no API call, no cost, always
 * current. A separate section from the AI-generated news summaries below
 * (see InsightsPanel) so it's clear which is which: this one is exact
 * math on your own data, that one is an LLM's read of the news.
 */
export function QuickInsightsCard({ insights }: QuickInsightsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick Insights</CardTitle>
        <p className="text-xs text-muted-foreground">
          Rule-based observations from your own data — free, instant, no AI involved.
        </p>
      </CardHeader>
      <CardContent>
        {insights.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing stands out right now — no concentration, currency, or cash-drag flags.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {insights.map((insight) => {
              const Icon = TONE_ICON[insight.tone];
              return (
                <li key={insight.id} className="flex items-start gap-2 text-sm">
                  <Icon className={`mt-0.5 size-4 shrink-0 ${TONE_CLASS[insight.tone]}`} />
                  <span>{insight.message}</span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
