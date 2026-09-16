"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  LOCALE_LABEL,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@/lib/validation/settings";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils/format";

const SELECT_CLASS = "h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm";

/** A fixed sample so the preview shows the effect of the locale alone —
 * thousands separator, decimal mark, symbol placement, month name — and not
 * of whatever the portfolio happens to be worth today. */
const PREVIEW_AMOUNT = "127438.2";
const PREVIEW_PERCENT = "0.1243";
const PREVIEW_DATE = "2026-03-09T00:00:00.000Z";

interface ProfileFormProps {
  name: string;
  email: string;
  locale: string;
  baseCurrency: string;
}

interface FormValues {
  name: string;
  locale: SupportedLocale;
}

function isSupportedLocale(value: string): value is SupportedLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

export function ProfileForm({ name, email, locale, baseCurrency }: ProfileFormProps) {
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
      // A locale that's no longer offered (or was never in the list) would
      // leave the select with no matching option and silently submit the
      // first one — fall back visibly to the stored default instead.
      locale: isSupportedLocale(locale) ? locale : "en-US",
    },
  });

  // Previewed live from the form value, not the saved one, so the effect of
  // a change is visible before committing to it.
  const selectedLocale = watch("locale");

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to save profile");
        return;
      }
      toast.success("Profile saved");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="name">Display name</FieldLabel>
          <Input id="name" {...register("name", { required: "Required" })} />
          {errors.name && <FieldError>{errors.name.message}</FieldError>}
        </Field>

        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input id="email" value={email} disabled readOnly />
          <p className="text-xs text-muted-foreground">
            Your sign-in address — changing it needs email verification, so it stays fixed here.
          </p>
        </Field>

        <Field>
          <FieldLabel htmlFor="locale">Number &amp; date format</FieldLabel>
          <select id="locale" className={SELECT_CLASS} {...register("locale")}>
            {SUPPORTED_LOCALES.map((option) => (
              <option key={option} value={option}>
                {LOCALE_LABEL[option]}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Affects how amounts and dates are displayed. Nothing stored changes.
          </p>
        </Field>

        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <div className="text-xs font-medium text-muted-foreground">Preview</div>
          <div className="mt-1 flex flex-col gap-0.5 tabular-nums">
            <span>{formatCurrency(PREVIEW_AMOUNT, baseCurrency, { locale: selectedLocale })}</span>
            <span>{formatPercent(PREVIEW_PERCENT, { locale: selectedLocale })}</span>
            <span>{formatDate(PREVIEW_DATE, { locale: selectedLocale })}</span>
          </div>
        </div>
      </div>

      <Button type="submit" disabled={submitting || !isDirty} className="w-fit">
        {submitting ? "Saving…" : "Save profile"}
      </Button>
    </form>
  );
}
