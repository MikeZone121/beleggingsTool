"use client";

import { usePrivacyMode } from "@/components/privacy-mode-provider";
import { formatCurrency } from "@/lib/utils/format";

export interface SeasonalityMonth {
  month: number;
  income: number;
  paymentCount: number;
}

interface SeasonalityStripProps {
  months: SeasonalityMonth[];
  currency: string;
}

const MONTH_LABELS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Which calendar months actually pay, with every year folded together —
 * quarterly payers sit on fixed months, so most dividend portfolios have
 * a few fat months and several near-empty ones. A 12-cell strip shaded
 * by relative size answers "when does my income actually arrive" at a
 * glance, which a time-ordered bar chart (see MonthlyIncomeChart)
 * deliberately doesn't: that one shows history, this one shows rhythm.
 */
export function SeasonalityStrip({ months, currency }: SeasonalityStripProps) {
  const { hidden } = usePrivacyMode();
  const max = Math.max(...months.map((m) => m.income), 0);

  if (max <= 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No paid dividends on record yet — this fills in as payments come through.
      </p>
    );
  }

  const best = months.reduce((a, b) => (b.income > a.income ? b : a));

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-12 gap-1">
        {months.map((m, i) => {
          // Floor the non-empty months at a visible opacity so a small
          // but real payment doesn't look identical to a zero month.
          const intensity = m.income > 0 ? 0.15 + (m.income / max) * 0.85 : 0;
          return (
            <div key={m.month} className="flex flex-col items-center gap-1">
              <div
                className="h-10 w-full rounded-md border border-border"
                style={{ backgroundColor: `color-mix(in oklch, var(--chart-1) ${intensity * 100}%, transparent)` }}
                title={`${MONTH_NAMES[i]}: ${hidden ? "•••••" : formatCurrency(m.income, currency)} across ${m.paymentCount} payment${m.paymentCount === 1 ? "" : "s"}`}
              />
              <span className="text-xs text-muted-foreground">{MONTH_LABELS[i]}</span>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Darkest month is {MONTH_NAMES[best.month - 1]} at{" "}
        {hidden ? "•••••" : formatCurrency(best.income, currency)} received across all years on
        record. Hover any month for its total.
      </p>
    </div>
  );
}
