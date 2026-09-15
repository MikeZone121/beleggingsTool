"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BenchmarkChart, type BenchmarkChartPoint } from "@/components/charts/benchmark-chart";

interface BenchmarkCardProps {
  initialTicker: string;
  initialPoints: BenchmarkChartPoint[];
}

export function BenchmarkCard({ initialTicker, initialPoints }: BenchmarkCardProps) {
  const [ticker, setTicker] = useState(initialTicker);
  const [tickerInput, setTickerInput] = useState(initialTicker);
  const [points, setPoints] = useState(initialPoints);
  const [loading, setLoading] = useState(false);

  async function handleCompare() {
    const next = tickerInput.trim().toUpperCase();
    if (!next) return;
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
        <div className="flex items-center gap-1.5">
          <Input
            value={tickerInput}
            onChange={(e) => setTickerInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCompare();
            }}
            placeholder="e.g. URTH, SPY, VT"
            className="h-8 w-32"
          />
          <Button size="sm" variant="outline" onClick={handleCompare} disabled={loading}>
            {loading ? "Loading…" : "Compare"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <BenchmarkChart data={points} benchmarkTicker={ticker} />
        <p className="mt-3 text-xs text-muted-foreground">
          Portfolio growth is total value change since your first sampled date — it is{" "}
          <span className="font-medium text-foreground">not</span> adjusted for deposits or
          withdrawals during the period, so a large deposit will show up here as apparent gain.
          The benchmark line is that ticker&apos;s own price return over the same dates. Needs
          price history synced (see the button above) to be accurate.
        </p>
      </CardContent>
    </Card>
  );
}
