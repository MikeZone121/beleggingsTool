"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrivacyMode } from "@/components/privacy-mode-provider";

export interface BenchmarkChartPoint {
  date: string;
  portfolioReturn: number;
  benchmarkReturn: number | null;
}

interface BenchmarkChartProps {
  data: BenchmarkChartPoint[];
  benchmarkTicker: string;
}

function formatPercent(value: number): string {
  return `${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`;
}

/**
 * Two comparable time series — cumulative % return, not two different
 * value scales — so a line chart with a shared axis, not two bar series
 * (see the dataviz skill's form guidance for "comparison over time").
 */
export function BenchmarkChart({ data, benchmarkTicker }: BenchmarkChartProps) {
  const { hidden } = usePrivacyMode();

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Not enough history yet — sync price history and make sure you have transactions
        recorded.
      </p>
    );
  }

  if (hidden) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Hidden while privacy mode is on
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          minTickGap={32}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickFormatter={(value) => formatPercent(Number(value))}
          width={56}
        />
        <Tooltip
          formatter={(value, name) => [
            value === null ? "—" : formatPercent(Number(value)),
            name === "portfolioReturn" ? "Portfolio" : benchmarkTicker,
          ]}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            color: "var(--popover-foreground)",
          }}
          labelStyle={{ color: "var(--popover-foreground)" }}
          itemStyle={{ color: "var(--popover-foreground)" }}
        />
        <Line
          type="monotone"
          dataKey="portfolioReturn"
          name="portfolioReturn"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="benchmarkReturn"
          name="benchmarkReturn"
          stroke="var(--chart-2)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
