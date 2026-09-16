"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Decimal from "decimal.js";
import { TriangleAlert } from "lucide-react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BENCHMARK_PRESETS, DEFAULT_BENCHMARK_TICKER } from "@/lib/finance/benchmarks";
import { COMMON_CURRENCIES } from "@/lib/finance/currencies";

const SELECT_CLASS = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm";
const HUNDRED = new Decimal(100);

interface PortfolioSettingsFormProps {
  name: string;
  baseCurrency: string;
  benchmarkTicker: string | null;
  /** Stored as a fraction ("0.3"); entered here as a percentage. */
  dividendTaxRate: string;
}

interface FormValues {
  name: string;
  baseCurrency: string;
  benchmarkTicker: string;
  dividendTaxPercent: string;
}

export function PortfolioSettingsForm({
  name,
  baseCurrency,
  benchmarkTicker,
  dividendTaxRate,
}: PortfolioSettingsFormProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isDirty },
  } = useForm<FormValues>({
    defaultValues: {
      name,
      baseCurrency,
      benchmarkTicker: benchmarkTicker ?? "",
      dividendTaxPercent: new Decimal(dividendTaxRate).times(HUNDRED).toString(),
    },
  });

  // A base-currency switch re-converts every figure in the app, so it gets
  // an explicit warning before saving rather than after.
  const currencyChanged = watch("baseCurrency") !== baseCurrency;

  async function onSubmit(values: FormValues) {
    let dividendTaxRateFraction: string;
    try {
      // Decimal, not `Number(x) / 100` — the same rule as everywhere else
      // in this app: a rate like 26.375% must not pick up binary
      // floating-point noise on its way into the database.
      dividendTaxRateFraction = new Decimal(values.dividendTaxPercent.replace(",", "."))
        .dividedBy(HUNDRED)
        .toString();
    } catch {
      toast.error("Enter the withholding tax as a number, e.g. 30");
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/settings/portfolio", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          baseCurrency: values.baseCurrency,
          benchmarkTicker: values.benchmarkTicker,
          dividendTaxRate: dividendTaxRateFraction,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to save portfolio settings");
        return;
      }
      if (result.data?.fxRefreshError) {
        toast.warning(
          "Saved, but exchange rates for the new base currency couldn't be fetched — use Refresh All on the dashboard"
        );
      } else if (result.data?.baseCurrencyChanged) {
        toast.success("Saved — exchange rates refreshed for the new base currency");
      } else {
        toast.success("Portfolio settings saved");
      }
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="portfolioName">Portfolio name</FieldLabel>
          <Input id="portfolioName" {...register("name", { required: "Required" })} />
          {errors.name && <FieldError>{errors.name.message}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor="baseCurrency">Base currency</FieldLabel>
          <select id="baseCurrency" className={SELECT_CLASS} {...register("baseCurrency")}>
            {COMMON_CURRENCIES.map((currency) => (
              <option key={currency.code} value={currency.code}>
                {currency.code} — {currency.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            The currency every total, return and chart is reported in.
          </p>
        </Field>

        <Field>
          <FieldLabel htmlFor="benchmarkTicker">Benchmark</FieldLabel>
          <Input
            id="benchmarkTicker"
            list="benchmark-presets"
            placeholder={DEFAULT_BENCHMARK_TICKER}
            {...register("benchmarkTicker")}
          />
          {/* A datalist rather than a select: the presets are shortcuts,
              but any ticker the data provider resolves is valid. */}
          <datalist id="benchmark-presets">
            {BENCHMARK_PRESETS.map((preset) => (
              <option key={preset.ticker} value={preset.ticker}>
                {preset.label} — {preset.description}
              </option>
            ))}
          </datalist>
          <p className="text-xs text-muted-foreground">
            What Analytics compares your portfolio against. Leave empty for the default (
            {DEFAULT_BENCHMARK_TICKER}).
          </p>
        </Field>

        <Field>
          <FieldLabel htmlFor="dividendTaxPercent">Dividend withholding tax</FieldLabel>
          <div className="flex items-center gap-2">
            <Input
              id="dividendTaxPercent"
              inputMode="decimal"
              className="w-24"
              {...register("dividendTaxPercent", { required: "Required" })}
            />
            <span className="text-sm text-muted-foreground">%</span>
          </div>
          {errors.dividendTaxPercent && (
            <FieldError>{errors.dividendTaxPercent.message}</FieldError>
          )}
          <p className="text-xs text-muted-foreground">
            Used to estimate net dividend payouts. 30% is the Belgian flat rate.
          </p>
        </Field>
      </div>

      {currencyChanged && (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Changing the base currency re-values your whole portfolio through exchange rates.
            Your transactions keep their own currencies and amounts — nothing is rewritten — but
            historical totals and returns will be restated, and the rates for the new currency
            are fetched on save.
          </span>
        </p>
      )}

      <Button type="submit" disabled={submitting || !isDirty} className="w-fit">
        {submitting ? "Saving…" : "Save portfolio settings"}
      </Button>
    </form>
  );
}
