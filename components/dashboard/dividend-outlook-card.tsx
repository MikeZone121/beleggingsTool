import { CalendarClock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { formatDate } from "@/lib/utils/format";
import { getUserLocale } from "@/lib/utils/serverLocale";

export interface DividendOutlookPayment {
  securityId: string;
  ticker: string;
  name: string;
  /** ISO date string of the estimated ex-dividend date. */
  exDate: string;
  /** Estimated net payout in the base currency, or null when no FX rate
   * could be resolved. */
  netBase: string | null;
  /** Whole days from today to `exDate`, computed on the server so the
   * number can't disagree with the server-rendered date next to it. */
  daysUntil: number;
}

interface DividendOutlookCardProps {
  windowDays: number;
  /** Projected payments inside the window, soonest first. */
  payments: DividendOutlookPayment[];
  /** Total estimated net across `payments`. */
  totalNetBase: string;
  /** Whether a payment in the window is missing an FX rate, so the total
   * covers only part of it. */
  hasMissingFx: boolean;
  /** The nearest projected payment even when it falls outside the window —
   * lets the card say when the next one is instead of going blank. */
  nextBeyondWindow: DividendOutlookPayment | null;
  baseCurrency: string;
}

/** How many payments to name before collapsing the rest into a count. Three
 * fits the card beside the Today card without scrolling; the full table
 * lives on the Dividends page. */
const MAX_LISTED = 3;

function countdown(daysUntil: number): string {
  if (daysUntil === 0) return "today";
  if (daysUntil === 1) return "tomorrow";
  return `in ${daysUntil} days`;
}

/**
 * What dividend income is expected in the next `windowDays` — the "what's
 * coming" counterpart to the Today card's "what just happened". A window
 * rather than only the single nearest payment: one date in isolation
 * doesn't say whether next month holds one payment or five, which is the
 * thing worth knowing at a glance. The full projection table lives on the
 * Dividends page.
 *
 * Every figure here is a projection from past cadence (see
 * `estimateNextDividend`), never a confirmed announcement, so the wording
 * stays explicitly estimated throughout.
 */
export async function DividendOutlookCard({
  windowDays,
  payments,
  totalNetBase,
  hasMissingFx,
  nextBeyondWindow,
  baseCurrency,
}: DividendOutlookCardProps) {
  const locale = await getUserLocale();
  const heading = `Next ${windowDays} Days`;

  if (payments.length === 0) {
    return (
      <Card>
        <CardContent>
          <h2 className="text-sm font-medium text-muted-foreground">{heading}</h2>
          {nextBeyondWindow ? (
            <>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-semibold">{nextBeyondWindow.ticker}</span>
                <span className="text-base text-muted-foreground">
                  {countdown(nextBeyondWindow.daysUntil)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">
                No dividends expected in the next {windowDays} days — the next one is estimated
                for {formatDate(nextBeyondWindow.exDate, { locale })}.
              </p>
            </>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">
              No projected payouts yet — sync dividend history to estimate one.
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  const listed = payments.slice(0, MAX_LISTED);
  const remaining = payments.length - listed.length;

  return (
    <Card>
      <CardContent>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium text-muted-foreground">{heading}</h2>
            <div className="mt-1 text-2xl font-semibold tabular-nums">
              <Money value={totalNetBase} currency={baseCurrency} />
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {hasMissingFx
                ? `Incomplete — missing FX rate · ${payments.length} est. payment${payments.length === 1 ? "" : "s"}`
                : `est. net across ${payments.length} payment${payments.length === 1 ? "" : "s"}`}
            </p>
          </div>
          <CalendarClock className="size-4 shrink-0 text-muted-foreground" />
        </div>

        <ul className="mt-3 flex flex-col gap-1.5 border-t border-border pt-3">
          {listed.map((payment) => (
            <li key={payment.securityId} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-baseline gap-2">
                <span className="font-medium">{payment.ticker}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {countdown(payment.daysUntil)} · {formatDate(payment.exDate, { locale })}
                </span>
              </span>
              <span className="shrink-0 tabular-nums">
                {payment.netBase ? (
                  <Money value={payment.netBase} currency={baseCurrency} />
                ) : (
                  "—"
                )}
              </span>
            </li>
          ))}
          {remaining > 0 && (
            <li className="text-xs text-muted-foreground">
              + {remaining} more in the next {windowDays} days
            </li>
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
