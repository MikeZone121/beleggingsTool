"use client";

import type { FieldErrors, UseFormRegister } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { ASSET_TYPES } from "@/lib/validation/security";

/** The shape both the add and the edit dialog bind to. Strings throughout
 * (not `string | null`): an HTML input has no null, and each dialog maps
 * "" back onto null in its own payload. */
export interface SecurityFormValues {
  ticker: string;
  name: string;
  assetType: (typeof ASSET_TYPES)[number];
  exchange: string;
  currency: string;
  isin: string;
  country: string;
  sector: string;
  currentPrice: string;
}

/** Shared field grid, so adding and editing a security can never drift
 * apart on which fields exist or how they're labeled. `idPrefix` keeps the
 * `htmlFor`/`id` pairs unique when both dialogs are mounted on the same
 * page (the Securities page mounts the add dialog alongside a row dialog). */
export function SecurityFormFields({
  register,
  errors,
  idPrefix,
}: {
  register: UseFormRegister<SecurityFormValues>;
  errors: FieldErrors<SecurityFormValues>;
  idPrefix: string;
}) {
  const id = (name: string) => `${idPrefix}-${name}`;

  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor={id("ticker")}>Ticker</FieldLabel>
          <Input id={id("ticker")} {...register("ticker", { required: "Required" })} />
          {errors.ticker && <FieldError>{errors.ticker.message}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor={id("assetType")}>Asset type</FieldLabel>
          <select
            id={id("assetType")}
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            {...register("assetType")}
          >
            {ASSET_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field>
        <FieldLabel htmlFor={id("name")}>Name</FieldLabel>
        <Input id={id("name")} {...register("name", { required: "Required" })} />
        {errors.name && <FieldError>{errors.name.message}</FieldError>}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field>
          <FieldLabel htmlFor={id("exchange")}>Exchange</FieldLabel>
          <Input id={id("exchange")} placeholder="NASDAQ, AMS…" {...register("exchange")} />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("currency")}>Currency</FieldLabel>
          <Input id={id("currency")} maxLength={3} {...register("currency", { required: true })} />
          {errors.currency && <FieldError>{errors.currency.message}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor={id("isin")}>ISIN (optional)</FieldLabel>
          <Input id={id("isin")} maxLength={12} {...register("isin")} />
          {errors.isin && <FieldError>{errors.isin.message}</FieldError>}
        </Field>
        <Field>
          <FieldLabel htmlFor={id("country")}>Country (optional)</FieldLabel>
          <Input id={id("country")} maxLength={2} placeholder="US, NL…" {...register("country")} />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("sector")}>Sector (optional)</FieldLabel>
          <Input id={id("sector")} {...register("sector")} />
        </Field>
        <Field>
          <FieldLabel htmlFor={id("currentPrice")}>Current price (optional)</FieldLabel>
          <Input id={id("currentPrice")} inputMode="decimal" {...register("currentPrice")} />
          {errors.currentPrice && <FieldError>{errors.currentPrice.message}</FieldError>}
        </Field>
      </div>
    </>
  );
}

/** Maps the form's strings onto the JSON body both `/api/securities`
 * (POST) and `/api/securities/[id]` (PATCH) accept — "" means "not set",
 * which the API expects as null, never as an empty string. */
export function toSecurityPayload(values: SecurityFormValues) {
  return {
    ticker: values.ticker,
    name: values.name,
    assetType: values.assetType,
    exchange: values.exchange || null,
    currency: values.currency,
    isin: values.isin || null,
    country: values.country || null,
    sector: values.sector || null,
    currentPrice: values.currentPrice || null,
  };
}
