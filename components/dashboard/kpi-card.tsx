import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: ReactNode;
  sublabel?: ReactNode;
  tone?: "neutral" | "positive" | "negative";
}

export function KpiCard({ label, value, sublabel, tone = "neutral" }: KpiCardProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-2xl font-semibold tabular-nums",
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
