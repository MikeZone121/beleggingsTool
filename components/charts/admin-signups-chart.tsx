"use client";

import { format, parseISO } from "date-fns";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface SignupChartPoint {
  date: string;
  count: number;
}

/** Daily new-account counts over the trailing window — a single series,
 * so no legend is needed (the card title above it already names it). */
export function AdminSignupsChart({ data }: { data: SignupChartPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => format(parseISO(value), "MMM d")}
          tickLine={false}
          axisLine={{ stroke: "var(--border)" }}
          tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
          interval={Math.ceil(data.length / 8)}
        />
        <YAxis hide allowDecimals={false} />
        <Tooltip
          labelFormatter={(value) => format(parseISO(String(value)), "MMM d, yyyy")}
          formatter={(value) => [`${value}`, "Signups"]}
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
        <Bar dataKey="count" radius={[4, 4, 0, 0]} className="fill-chart-1" maxBarSize={24} />
      </BarChart>
    </ResponsiveContainer>
  );
}
