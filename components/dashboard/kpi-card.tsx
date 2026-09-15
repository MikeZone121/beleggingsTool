import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  tone?: "neutral" | "positive" | "negative";
  /** Marks the primary metric on a KPI grid — a subtle tinted border/background. */
  highlight?: boolean;
}

export function KpiCard({ label, value, sublabel, tone = "neutral", highlight = false }: KpiCardProps) {
  return (
    <Card
      className={cn(
        highlight && "bg-gradient-to-br from-primary/[0.06] to-transparent ring-primary/20"
      )}
    >
      <CardHeader className="pb-2">
        <CardTitle
          className={cn(
            "text-sm font-medium text-muted-foreground",
            highlight && "text-primary/80"
          )}
        >
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "font-semibold tabular-nums",
            highlight ? "text-3xl" : "text-2xl",
            tone === "positive" && "text-emerald-600 dark:text-emerald-400",
            tone === "negative" && "text-red-600 dark:text-red-400"
          )}
        >
          {value}
        </div>
        {sublabel && <p className="mt-1 text-xs text-muted-foreground">{sublabel}</p>}
      </CardContent>
    </Card>
  );
}
