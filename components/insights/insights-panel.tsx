"use client";

import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils/format";
import { useLocale } from "@/components/locale-provider";

interface HeadlineData {
  title: string;
  publisher: string;
  publishedAt: string;
  url: string;
}

interface HoldingInsightData {
  securityId: string;
  ticker: string;
  name: string;
  headlines: HeadlineData[];
  summary: string | null;
  error: string | null;
}

interface InsightsPanelProps {
  aiConfigured: boolean;
  providerSupportsNews: boolean;
}

export function InsightsPanel({ aiConfigured, providerSupportsNews }: InsightsPanelProps) {
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [insights, setInsights] = useState<HoldingInsightData[] | null>(null);

  async function handleGenerate() {
    setLoading(true);
    try {
      const response = await fetch("/api/insights/generate", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to generate insights");
        return;
      }
      setInsights(result.data.insights);
    } finally {
      setLoading(false);
    }
  }

  if (!providerSupportsNews) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        The configured market-data provider doesn&apos;t supply news headlines (only Yahoo does
        right now). Set <code className="text-foreground">FINANCIAL_DATA_PROVIDER=yahoo</code> to
        enable this.
      </div>
    );
  }

  if (!aiConfigured) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        AI insights aren&apos;t configured yet. Add an{" "}
        <code className="text-foreground">ANTHROPIC_API_KEY</code> to your environment to enable
        this — headlines can still be fetched, but summarizing them needs a Claude API key.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Summarizes recent news per holding — informational only, never a buy/sell/hold opinion.
          Each holding is one Claude API call, so this costs a small amount to run.
        </p>
        <Button onClick={handleGenerate} disabled={loading}>
          <Sparkles className={loading ? "size-4 animate-pulse" : "size-4"} />
          {loading ? "Generating…" : insights ? "Regenerate" : "Generate Insights"}
        </Button>
      </div>

      {insights && (
        <div className="flex flex-col gap-3">
          {insights.length === 0 && (
            <p className="text-sm text-muted-foreground">No current holdings to summarize.</p>
          )}
          {insights.map((holding) => (
            <div
              key={holding.securityId}
              className="rounded-xl border border-border bg-card p-4 shadow-sm shadow-black/5"
            >
              <div className="flex items-baseline gap-2">
                <span className="font-medium">{holding.ticker}</span>
                <span className="text-sm text-muted-foreground">{holding.name}</span>
              </div>

              {holding.summary && <p className="mt-2 text-sm">{holding.summary}</p>}
              {!holding.summary && holding.error && (
                <p className="mt-2 text-sm text-destructive">Couldn&apos;t summarize: {holding.error}</p>
              )}
              {!holding.summary && !holding.error && holding.headlines.length === 0 && (
                <p className="mt-2 text-sm text-muted-foreground">No recent headlines found.</p>
              )}

              {holding.headlines.length > 0 && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-muted-foreground">
                    {holding.headlines.length} source headline{holding.headlines.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="mt-2 flex flex-col gap-1.5">
                    {holding.headlines.map((h) => (
                      <li key={h.url} className="flex items-start gap-1.5 text-xs">
                        <Badge variant="secondary" className="shrink-0">
                          {formatDate(h.publishedAt, { locale })}
                        </Badge>
                        <a
                          href={h.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground hover:underline"
                        >
                          {h.title} — {h.publisher}
                          <ExternalLink className="size-3 shrink-0" />
                        </a>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
