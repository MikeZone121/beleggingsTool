import { CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { formatDate } from "@/lib/utils/format";
import { getUserLocale } from "@/lib/utils/serverLocale";

interface NextDividendCardProps {
  ticker: string | null;
  name: string | null;
  /** ISO date string of the estimated next ex-dividend date. */
  exDate: string | null;
  /** Estimated net payout in the base currency, or null when no FX rate
   * could be resolved. */
  netBase: string | null;
  baseCurrency: string;
  /** Whole days from today to `exDate`, computed on the server so the
   * number can't disagree with the server-rendered date next to it. */
  daysUntil: number | null;
}

/**
 * The single nearest upcoming estimated ex-dividend date across all
 * holdings — the "what's next" counterpart to the Today card's "what
 * just happened". The full projection table lives on the Dividends
 * page; this is only the next one, because that's the one worth
 * remembering.
 */
export async function NextDividendCard({
  ticker,
  name,
  exDate,
  netBase,
  baseCurrency,
  daysUntil,
}: NextDividendCardProps) {
  const locale = await getUserLocale();

  if (!ticker || !exDate) {
    return (
      <Card>
        <CardContent>
          <h2 className="text-sm font-medium text-muted-foreground">Next Dividend</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            No projected payouts yet — sync dividend history to estimate one.
          </p>
        </CardContent>
      </Card>
    );
  }

  const countdown =
    daysUntil === null
      ? null
      : daysUntil <= 0
        ? "today"
        : daysUntil === 1
          ? "tomorrow"
          : `in ${daysUntil} days`;

  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">Next Dividend</h2>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-semibold">{ticker}</span>
              {countdown && <span className="text-base text-muted-foreground">{countdown}</span>}
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {name} · est. ex-date {formatDate(exDate, { locale })}
            </p>
          </div>
          <div className="flex items-center gap-2 text-right">
            <CalendarClock className="size-4 text-muted-foreground" />
            <div>
              <div className="font-medium tabular-nums">
                {netBase ? <Money value={netBase} currency={baseCurrency} /> : "—"}
              </div>
              <div className="text-xs text-muted-foreground">est. net</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
