"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils/format";
import { usePrivacyMode } from "@/components/privacy-mode-provider";

/** Fixed categorical fill order — see app/globals.css `--chart-1..8`
 * (validated palette, dataviz skill). Assign by category IDENTITY where a
 * fixed enum exists (e.g. asset type), never by rank/value, so a filtered
 * view never repaints the categories that remain. */
const CHART_FILL_CLASSES = [
  "fill-chart-1",
  "fill-chart-2",
  "fill-chart-3",
  "fill-chart-4",
  "fill-chart-5",
  "fill-chart-6",
  "fill-chart-7",
  "fill-chart-8",
] as const;

export interface AllocationChartBucket {
  key: string;
  label: string;
  value: number;
  weight: number;
}

interface AllocationBarProps {
  buckets: AllocationChartBucket[];
  currency: string;
  /** Optional fixed identity order (e.g. the AssetType enum) so a category's
   * color never depends on its rank. Falls back to alphabetical-by-label. */
  identityOrder?: readonly string[];
}

const OTHER_KEY = "__other__";
const MAX_SLOTS = 8;

function foldToTopSlots(buckets: AllocationChartBucket[]): AllocationChartBucket[] {
  if (buckets.length <= MAX_SLOTS) return buckets;
  const sorted = buckets.slice().sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, MAX_SLOTS - 1);
  const rest = sorted.slice(MAX_SLOTS - 1);
  const other: AllocationChartBucket = {
    key: OTHER_KEY,
    label: "Other",
    value: rest.reduce((acc, b) => acc + b.value, 0),
    weight: rest.reduce((acc, b) => acc + b.weight, 0),
  };
  return [...top, other];
}

/**
 * Part-to-whole allocation as a single horizontal stacked bar + legend list —
 * per the dataviz skill's form guidance (composition -> stacked bar, not a
 * pie/donut). Color is assigned by category identity when `identityOrder` is
 * given, otherwise alphabetically, so redrawing with fewer categories never
 * reassigns the colors of the ones that remain.
 */
export function AllocationBar({ buckets, currency, identityOrder }: AllocationBarProps) {
  const { hidden } = usePrivacyMode();
  const formatValue = (value: number) => (hidden ? "•••••" : formatCurrency(value, currency));
  if (buckets.length === 0) {
    return <p className="text-sm text-muted-foreground">No data available.</p>;
  }

  const folded = foldToTopSlots(buckets);
  const ordered = identityOrder
    ? folded.slice().sort((a, b) => {
        if (a.key === OTHER_KEY) return 1;
        if (b.key === OTHER_KEY) return -1;
        return identityOrder.indexOf(a.key) - identityOrder.indexOf(b.key);
      })
    : folded.slice().sort((a, b) => {
        if (a.key === OTHER_KEY) return 1;
        if (b.key === OTHER_KEY) return -1;
        return a.label.localeCompare(b.label);
      });

  const colorClassByKey = new Map<string, string>();
  ordered.forEach((bucket, i) => {
    colorClassByKey.set(
      bucket.key,
      bucket.key === OTHER_KEY ? "fill-muted-foreground/40" : CHART_FILL_CLASSES[i % MAX_SLOTS]
    );
  });

  const row: Record<string, number | string> = { name: "allocation" };
  for (const bucket of ordered) {
    row[bucket.key] = bucket.value;
  }

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={32}>
        <BarChart
          layout="vertical"
          data={[row]}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
        >
          <XAxis type="number" hide domain={[0, "dataMax"]} />
          <YAxis type="category" dataKey="name" hide />
          <Tooltip
            formatter={(value, key) => [
              formatValue(Number(value ?? 0)),
              ordered.find((b) => b.key === key)?.label ?? String(key),
            ]}
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "var(--popover)",
              color: "var(--popover-foreground)",
            }}
          />
          {ordered.map((bucket) => (
            <Bar
              key={bucket.key}
              dataKey={bucket.key}
              stackId="allocation"
              radius={0}
              barSize={24}
              stroke="var(--background)"
              strokeWidth={2}
              className={colorClassByKey.get(bucket.key)}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>

      <ul className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {ordered.map((bucket) => (
          <li key={bucket.key} className="flex items-center gap-2 text-sm">
            <span
              className={cn("size-2.5 shrink-0 rounded-full", colorClassByKey.get(bucket.key))}
              aria-hidden
            />
            <span className="truncate">{bucket.label}</span>
            <span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
              {(bucket.weight * 100).toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
