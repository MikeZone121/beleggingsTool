"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { usePrivacyMode } from "@/components/privacy-mode-provider";

export interface MonthlyIncomePoint {
  periodKey: string;
  label: string;
  income: number;
}

interface MonthlyIncomeChartProps {
  data: MonthlyIncomePoint[];
  currency: string;
}

/**
 * Monthly dividend income — magnitude-over-ordered-categories, a single
 * series, so a plain bar chart in the sequential hue (never categorical
 * colors per bar — see the dataviz skill's form guidance).
 */
export function MonthlyIncomeChart({ data, currency }: MonthlyIncomeChartProps) {
  const { hidden } = usePrivacyMode();

  if (data.length === 0) {
    return <p className="text-sm text-muted-foreground">No dividend income yet.</p>;
  }

  if (hidden) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Hidden while privacy mode is on
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <YAxis hide />
        <Tooltip
          formatter={(value) => formatCurrency(Number(value ?? 0), currency)}
          contentStyle={{
            fontSize: 12,
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--popover)",
            color: "var(--popover-foreground)",
          }}
          // See allocation-bar.tsx: Recharts defaults item text to the
          // series' own resolved color, which it can't read from our
          // Tailwind `fill-chart-*` class — force it explicitly instead.
          labelStyle={{ color: "var(--popover-foreground)" }}
          itemStyle={{ color: "var(--popover-foreground)" }}
        />
        <Bar dataKey="income" radius={[4, 4, 0, 0]} className="fill-chart-1" maxBarSize={28} />
      </BarChart>
    </ResponsiveContainer>
  );
}
