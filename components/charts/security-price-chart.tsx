"use client";

import { useState } from "react";
import {
  Brush,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  useXAxisScale,
  useYAxisScale,
} from "recharts";
import { formatCurrency } from "@/lib/utils/format";
import { usePrivacyMode } from "@/components/privacy-mode-provider";
import { Button } from "@/components/ui/button";
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

const UP_COLOR = "#10b981";
const DOWN_COLOR = "#ef4444";

/** ~6 months of trading days — a full multi-year history opened at full
 * zoom squashes everything into an unreadable flat line whenever the
 * price has moved a lot over that span (e.g. €5000 → €200), so start
 * zoomed into a recent, readable window instead. The Y axis re-scales to
 * whatever's visible (see YAxis domain below), so dragging the brush
 * strip to widen or narrow the range keeps the chart readable at any
 * zoom level rather than fixing the y-scale to the all-time range. */
const DEFAULT_VISIBLE_POINTS = 180;

/**
 * Open/high/low/close candles for whichever days have all four (a day
 * only backfilled from a "close only" source is simply skipped). Reads
 * the chart's own live axis scales via Recharts 3's hooks — this is
 * rendered as a plain child of `LineChart`, no `Customized` wrapper
 * needed — so it automatically tracks the current Brush zoom: a point
 * outside the zoomed range resolves to `undefined` from the scale and is
 * skipped, no manual slicing required.
 */
function CandlestickSeries({ data }: { data: SecurityChartPoint[] }) {
  const xScale = useXAxisScale();
  const yScale = useYAxisScale();
  if (!xScale || !yScale) return null;

  let step = 6;
  for (let i = 1; i < data.length; i++) {
    const x0 = xScale(data[i - 1].date);
    const x1 = xScale(data[i].date);
    if (x0 !== undefined && x1 !== undefined) {
      step = Math.abs(x1 - x0);
      break;
    }
  }
  const bodyWidth = Math.max(Math.min(step * 0.6, 12), 2);

  return (
    <g>
      {data.map((d) => {
        if (d.open === null || d.high === null || d.low === null) return null;
        const cx = xScale(d.date);
        const yHigh = yScale(d.high);
        const yLow = yScale(d.low);
        const yOpen = yScale(d.open);
        const yClose = yScale(d.close);
        if (
          cx === undefined ||
          yHigh === undefined ||
          yLow === undefined ||
          yOpen === undefined ||
          yClose === undefined
        ) {
          return null;
        }
        const isUp = d.close >= d.open;
        const color = isUp ? UP_COLOR : DOWN_COLOR;
        const bodyTop = Math.min(yOpen, yClose);
        const bodyHeight = Math.max(Math.abs(yOpen - yClose), 1);
        return (
          <g key={d.date}>
            <line x1={cx} x2={cx} y1={yHigh} y2={yLow} stroke={color} strokeWidth={1} />
            <rect x={cx - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
          </g>
        );
      })}
    </g>
  );
}

/**
 * Daily price with SMA 25/50/100 overlays and a Fibonacci retracement
 * grid (0/23.6/38.2/50/61.8/78.6/100%, from the swing high to the swing
 * low over the cached history — see securityChartService.ts). Read-only
 * technical context for a watched ticker, not a signal or recommendation.
 */
export function SecurityPriceChart({ data, fibonacciLevels, currency }: SecurityPriceChartProps) {
  const { hidden } = usePrivacyMode();
  const [view, setView] = useState<"line" | "candlestick">("line");

  if (data.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No price history yet — this fills in after the next price refresh.
      </p>
    );
  }

  if (hidden) {
    return (
      <div className="flex h-[420px] items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Hidden while privacy mode is on
      </div>
    );
  }

  const hasOhlc = data.some((d) => d.open !== null && d.high !== null && d.low !== null);
  const defaultStartIndex = Math.max(0, data.length - DEFAULT_VISIBLE_POINTS);

  return (
    <div className="flex flex-col gap-2">
      {hasOhlc && (
        <div className="flex justify-end gap-1">
          <Button
            variant={view === "line" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("line")}
          >
            Line
          </Button>
          <Button
            variant={view === "candlestick" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setView("candlestick")}
          >
            Candlestick
          </Button>
        </div>
      )}
      <ResponsiveContainer width="100%" height={420}>
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
          {view === "line" ? (
            <Line type="monotone" dataKey="close" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          ) : (
            <CandlestickSeries data={data} />
          )}
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
          <Brush
            dataKey="date"
            height={28}
            travellerWidth={8}
            startIndex={defaultStartIndex}
            stroke="var(--chart-1)"
            fill="var(--muted)"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
