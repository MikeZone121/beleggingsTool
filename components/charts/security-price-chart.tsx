"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { usePrivacyMode } from "@/components/privacy-mode-provider";
import type { SecurityChartPoint, SecurityFibonacciLevel } from "@/lib/portfolio/securityChartService";

interface SecurityPriceChartProps {
  data: SecurityChartPoint[];
  fibonacciLevels: SecurityFibonacciLevel[];
  currency: string;
}

const SERIES_LABEL: Record<string, string> = {
  close: "Price",
  sma25: "SMA 25",
  sma50: "SMA 50",
  sma100: "SMA 100",
};

/**
 * Daily close price with SMA 25/50/100 overlays and a Fibonacci
 * retracement grid (0/23.6/38.2/50/61.8/78.6/100%, from the swing high
 * to the swing low over the cached history — see securityChartService.ts).
 * Read-only technical context for a watched ticker, not a signal or
 * recommendation.
 */
export function SecurityPriceChart({ data, fibonacciLevels, currency }: SecurityPriceChartProps) {
  const { hidden } = usePrivacyMode();

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No price history yet — this fills in after the next price refresh.
      </p>
    );
  }

  if (hidden) {
    return (
      <div className="flex h-[380px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Hidden while privacy mode is on
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={380}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          minTickGap={48}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          tickFormatter={(value) => formatCurrency(Number(value), currency)}
          width={72}
          domain={["auto", "auto"]}
        />
        <Tooltip
          formatter={(value, name) => [
            value === null || value === undefined ? "—" : formatCurrency(Number(value), currency),
            SERIES_LABEL[String(name)] ?? String(name),
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
        <Legend
          formatter={(value) => SERIES_LABEL[value] ?? value}
          wrapperStyle={{ fontSize: 12, color: "var(--muted-foreground)" }}
          iconType="plainline"
        />
        {fibonacciLevels.map((level) => (
          <ReferenceLine
            key={level.label}
            y={level.price}
            stroke="var(--muted-foreground)"
            strokeDasharray="3 3"
            strokeOpacity={0.5}
            label={{
              value: `${level.label} · ${formatCurrency(level.price, currency)}`,
              position: "insideTopLeft",
              fill: "var(--muted-foreground)",
              fontSize: 10,
            }}
          />
        ))}
        <Line type="monotone" dataKey="close" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
        <Line
          type="monotone"
          dataKey="sma25"
          stroke="var(--chart-3)"
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="sma50"
          stroke="var(--chart-4)"
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
        <Line
          type="monotone"
          dataKey="sma100"
          stroke="var(--chart-7)"
          strokeWidth={1.5}
          dot={false}
          connectNulls
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
