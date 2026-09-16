"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrivacyMode } from "@/components/privacy-mode-provider";
import { useLocale } from "@/components/locale-provider";
import { formatCurrency, formatPercent } from "@/lib/utils/format";

export interface BenchmarkChartPoint {
  date: string;
  portfolioValueBase: number;
  benchmarkValueBase: number | null;
  portfolioReturn: number;
  benchmarkReturn: number | null;
}

interface BenchmarkChartProps {
  data: BenchmarkChartPoint[];
  benchmarkTicker: string;
  currency: string;
}

/**
 * Both lines are the same starting amount's value over time — the
 * portfolio's actual value, and what that same amount would be worth had
 * it gone into the benchmark ticker instead — so a currency axis is more
 * concrete than an abstract % axis. The tooltip still shows % alongside
 * the value for readers who want the relative comparison too.
 */
export function BenchmarkChart({ data, benchmarkTicker, currency }: BenchmarkChartProps) {
  const { hidden } = usePrivacyMode();
  const locale = useLocale();

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

  const returnByKey = new Map(
    data.flatMap((p) => [
      [`${p.date}:portfolio`, p.portfolioReturn],
      [`${p.date}:benchmark`, p.benchmarkReturn],
    ])
  );

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
          tickFormatter={(value) => formatCurrency(Number(value), currency, { locale })}
          width={72}
          // Recharts defaults a numeric axis to start at 0, which is right
          // for a bar chart but flattens this one: both lines track the
          // *same starting amount*, so their day-to-day movement is a
          // small fraction of the total value and disappears against a
          // 0-based scale. Auto-scaling to the data's own min/max is what
          // makes that movement visible.
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(value, name, item) => {
            if (value === null || value === undefined) return ["—", name];
            const isPortfolio = name === "portfolioValueBase";
            const returnValue = returnByKey.get(`${item.payload.date}:${isPortfolio ? "portfolio" : "benchmark"}`);
            const valueLabel = formatCurrency(Number(value), currency, { locale });
            const withReturn =
              typeof returnValue === "number"
                ? `${valueLabel} (${formatPercent(returnValue, { decimals: 1, signDisplay: "always", locale })})`
                : valueLabel;
            return [withReturn, isPortfolio ? "Portfolio" : benchmarkTicker];
          }}
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
        <Legend
          formatter={(value) => (value === "portfolioValueBase" ? "Portfolio" : benchmarkTicker)}
          wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
          iconType="plainline"
        />
        <Line
          type="monotone"
          dataKey="portfolioValueBase"
          name="portfolioValueBase"
          stroke="var(--chart-1)"
          strokeWidth={2}
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="benchmarkValueBase"
          name="benchmarkValueBase"
          stroke="var(--chart-2)"
          strokeWidth={2}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
