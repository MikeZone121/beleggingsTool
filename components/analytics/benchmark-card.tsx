"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BenchmarkChart, type BenchmarkChartPoint } from "@/components/charts/benchmark-chart";
import { formatDate } from "@/lib/utils/format";
import { TickerSearchField } from "./ticker-search-field";

interface BenchmarkCardProps {
  initialTicker: string;
  initialPoints: BenchmarkChartPoint[];
  initialError: string | null;
  currency: string;
}

export function BenchmarkCard({
  initialTicker,
  initialPoints,
  initialError,
  currency,
}: BenchmarkCardProps) {
  const [ticker, setTicker] = useState(initialTicker);
  const [points, setPoints] = useState(initialPoints);
  const [error, setError] = useState(initialError);
  const [loading, setLoading] = useState(false);

  async function handleSelect(next: string) {
    setLoading(true);
    try {
      const response = await fetch(`/api/analytics/benchmark?ticker=${encodeURIComponent(next)}`);
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to load benchmark comparison");
        return;
      }
      setPoints(result.data.points);
      setError(result.data.benchmarkError);
      setTicker(next);
    } finally {
      setLoading(false);
    }
  }

  const firstDate = points[0]?.date;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <div>
          <CardTitle className="text-base">Portfolio vs. Benchmark</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            {firstDate ? (
              <>
                On {formatDate(firstDate)} your portfolio was worth a certain amount. This shows
                what that same amount is worth today — as your actual portfolio, and as if
                it had gone into {ticker} instead.
              </>
            ) : (
              <>Compares your portfolio&apos;s value growth against a benchmark ticker.</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{loading ? "Loading…" : ticker}</Badge>
          <TickerSearchField placeholder="Compare to…" onSelect={handleSelect} />
        </div>
      </CardHeader>
      <CardContent>
        <BenchmarkChart data={points} benchmarkTicker={ticker} currency={currency} />
        {error && (
          <p className="mt-3 rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
            Couldn&apos;t load the {ticker} comparison line: {error}
          </p>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          The blue line is your actual reconstructed portfolio value — it starts at your first
          deposit, so a purchase made before that isn&apos;t double-counted. Any deposit or
          withdrawal <span className="font-medium text-foreground">after</span> the first one
          still shows up here as apparent gain/loss, since this isn&apos;t adjusted for the
          timing of contributions. Needs price history synced (see the button above) for the
          reconstruction to be accurate.
        </p>
      </CardContent>
    </Card>
  );
}
