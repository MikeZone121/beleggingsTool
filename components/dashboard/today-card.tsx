import { Card, CardContent } from "@/components/ui/card";
import { Money, Percent } from "@/components/ui/money";
import type { TodayMoverRow } from "@/lib/portfolio/todayMoversService";

interface TodayCardProps {
  totalChangeBase: string | null;
  totalChangePercent: string | null;
  movers: TodayMoverRow[];
  baseCurrency: string;
  hasData: boolean;
}

function moverToneClass(value: string): string {
  const n = Number(value);
  if (n > 0) return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400";
  if (n < 0) return "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-400";
  return "bg-muted text-muted-foreground";
}

/**
 * "How did today go" — the one question a portfolio value that only
 * updates on a manual refresh can't answer at a glance otherwise. Rolls
 * every holding's live price vs. its prior close into one signed total
 * (see todayMoversService.ts), plus which tickers moved the most.
 */
export function TodayCard({
  totalChangeBase,
  totalChangePercent,
  movers,
  baseCurrency,
  hasData,
}: TodayCardProps) {
  if (!hasData) {
    return (
      <Card>
        <CardContent>
          <h2 className="text-sm font-medium text-muted-foreground">Today</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No prior close cached yet for your holdings — this fills in once price history syncs.
          </p>
        </CardContent>
      </Card>
    );
  }

  const tone = totalChangeBase && Number(totalChangeBase) < 0 ? "negative" : "positive";
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : "text-red-600 dark:text-red-400";

  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Today</h2>
            <div className={`mt-1 flex items-baseline gap-2 text-2xl font-semibold tabular-nums ${toneClass}`}>
              <Money value={totalChangeBase} currency={baseCurrency} signDisplay="always" />
              {totalChangePercent && (
                <span className="text-base">
                  <Percent value={totalChangePercent} signDisplay="always" />
                </span>
              )}
            </div>
          </div>
          {movers.length > 0 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {movers.slice(0, 5).map((m) => (
                <span
                  key={m.securityId}
                  className={`rounded-full px-2 py-1 text-xs font-medium tabular-nums ${moverToneClass(m.dayChangePercent)}`}
                >
                  {m.ticker} <Percent value={m.dayChangePercent} signDisplay="always" />
                </span>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
