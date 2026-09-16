"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCurrency, formatPercent } from "@/lib/utils/format";
import { useLocale } from "@/components/locale-provider";
import { usePrivacyMode } from "@/components/privacy-mode-provider";

export interface AnnualIncomePoint {
  year: number;
  income: number;
  /** YoY growth vs. the prior year, null for the first year in the
   * series (nothing to compare against) or an in-progress current year. */
  growth: number | null;
}

interface AnnualIncomeChartProps {
  data: AnnualIncomePoint[];
  currency: string;
}

/**
 * Year-over-year dividend income — the "is my dividend income actually
 * growing" chart (Snowball Analytics calls this a dividend growth chart).
 * The monthly income chart above already shows recent cadence; this one
 * is for the multi-year trend the monthly view is too granular to read.
 */
export function AnnualIncomeChart({ data, currency }: AnnualIncomeChartProps) {
  const { hidden } = usePrivacyMode();
  const locale = useLocale();

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
          dataKey="year"
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
        />
        <YAxis hide />
        <Tooltip
          formatter={(value, _name, item) => {
            const growth = item.payload.growth as number | null;
            const valueLabel = formatCurrency(Number(value ?? 0), currency, { locale });
            return [growth !== null ? `${valueLabel} (${formatPercent(growth, { signDisplay: "always", locale })})` : valueLabel, "Income"];
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
        <Bar dataKey="income" radius={[4, 4, 0, 0]} className="fill-chart-1" maxBarSize={40} />
      </BarChart>
    </ResponsiveContainer>
  );
}
