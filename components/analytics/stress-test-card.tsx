"use client";

import { useState } from "react";
import Decimal from "decimal.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money, Percent } from "@/components/ui/money";

interface StressTestCardProps {
  /** Sum of all holdings' market value in the base currency — cash is
   * passed separately since a market shock doesn't touch it. */
  holdingsValueBase: string;
  cashBase: string;
  baseCurrency: string;
}

const PRESETS = [-10, -20, -30, -50];

/**
 * "If the market dropped X% tomorrow, what would I actually have" — a
 * uniform shock applied to holdings only (cash is untouched by
 * definition), not a real risk model or a prediction. Deliberately
 * simpler than scaling each holding by its own Beta: a single number
 * you can hold in your head is more useful for a gut-check than a
 * false sense of precision from a beta estimated off 2-3 data points.
 */
export function StressTestCard({ holdingsValueBase, cashBase, baseCurrency }: StressTestCardProps) {
  const [shockInput, setShockInput] = useState("-20");

  const holdingsValue = new Decimal(holdingsValueBase);
  const cash = new Decimal(cashBase);
  const currentTotal = holdingsValue.plus(cash);

  const parsedShock = new Decimal(shockInput.replace(",", ".") || "0");
  const shockPercent = parsedShock.isFinite() ? parsedShock : new Decimal(0);

  const shockedHoldingsValue = holdingsValue.times(shockPercent.dividedBy(100).plus(1));
  const shockedTotal = Decimal.max(shockedHoldingsValue, 0).plus(cash);
  const impact = shockedTotal.minus(currentTotal);
  const impactPercentOfTotal = currentTotal.greaterThan(0) ? impact.dividedBy(currentTotal) : null;

  const impactTone = impact.isNegative()
    ? "text-red-600 dark:text-red-400"
    : impact.isZero()
      ? ""
      : "text-emerald-600 dark:text-emerald-400";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Stress Test</CardTitle>
        <p className="text-xs text-muted-foreground">
          A uniform shock applied to your holdings (cash is unaffected) — a quick gut-check on
          risk tolerance, not a prediction or a real risk model.
        </p>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {PRESETS.map((p) => (
            <Button
              key={p}
              variant={shockInput === String(p) ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShockInput(String(p))}
            >
              {p}%
            </Button>
          ))}
          <div className="flex items-center gap-1">
            <Input
              inputMode="decimal"
              value={shockInput}
              onChange={(e) => setShockInput(e.target.value)}
              className="h-7 w-16 text-right tabular-nums"
              aria-label="Custom shock percentage"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Current Value</div>
            <div className="text-lg font-semibold tabular-nums">
              <Money value={currentTotal.toString()} currency={baseCurrency} />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">
              After <Percent value={shockPercent.dividedBy(100).toString()} signDisplay="always" />
            </div>
            <div className="text-lg font-semibold tabular-nums">
              <Money value={shockedTotal.toString()} currency={baseCurrency} />
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Impact</div>
            <div className={`text-lg font-semibold tabular-nums ${impactTone}`}>
              <Money value={impact.toString()} currency={baseCurrency} signDisplay="always" />
              {impactPercentOfTotal && (
                <span className="ml-1 text-sm">
                  (<Percent value={impactPercentOfTotal.toString()} signDisplay="always" />)
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
