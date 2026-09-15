"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BenchmarkChart, type BenchmarkChartPoint } from "@/components/charts/benchmark-chart";
import { TickerSearchField } from "./ticker-search-field";

interface BenchmarkCardProps {
  initialTicker: string;
  initialPoints: BenchmarkChartPoint[];
  currency: string;
}

export function BenchmarkCard({ initialTicker, initialPoints, currency }: BenchmarkCardProps) {
  const [ticker, setTicker] = useState(initialTicker);
  const [points, setPoints] = useState(initialPoints);
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
      setTicker(next);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">Portfolio vs. Benchmark</CardTitle>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">{loading ? "Loading…" : ticker}</Badge>
          <TickerSearchField placeholder="Compare to…" onSelect={handleSelect} />
        </div>
      </CardHeader>
      <CardContent>
        <BenchmarkChart data={points} benchmarkTicker={ticker} currency={currency} />
        <p className="mt-3 text-xs text-muted-foreground">
          Both lines show what your first sampled amount would be worth today — one as your
          actual portfolio, one as if it had gone into {ticker} instead. Portfolio growth is{" "}
          <span className="font-medium text-foreground">not</span> adjusted for deposits or
          withdrawals during the period, so a large deposit will show up here as apparent gain.
          Needs price history synced (see the button above) to be accurate.
        </p>
      </CardContent>
    </Card>
  );
}
