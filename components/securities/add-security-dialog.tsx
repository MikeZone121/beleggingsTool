"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ASSET_TYPES } from "@/lib/validation/security";

interface FormValues {
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

const defaultValues: FormValues = {
  ticker: "",
  name: "",
  assetType: "STOCK",
  exchange: "",
  currency: "EUR",
  isin: "",
  country: "",
  sector: "",
  currentPrice: "",
};

export function AddSecurityDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues });

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setServerError(null);
    try {
      const payload = {
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
      const response = await fetch("/api/securities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json();

      if (!response.ok) {
        setServerError(result.error?.message ?? "Failed to create security");
        return;
      }

      toast.success(`${values.ticker} added`);
      reset(defaultValues);
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setServerError(null);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus className="size-4" />
        Add security
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add security</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="ticker">Ticker</FieldLabel>
              <Input id="ticker" {...register("ticker", { required: "Required" })} />
              {errors.ticker && <FieldError>{errors.ticker.message}</FieldError>}
            </Field>
            <Field>
              <FieldLabel htmlFor="assetType">Asset type</FieldLabel>
              <select
                id="assetType"
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
            <FieldLabel htmlFor="name">Name</FieldLabel>
            <Input id="name" {...register("name", { required: "Required" })} />
            {errors.name && <FieldError>{errors.name.message}</FieldError>}
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field>
              <FieldLabel htmlFor="exchange">Exchange</FieldLabel>
              <Input id="exchange" placeholder="NASDAQ, AMS…" {...register("exchange")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="currency">Currency</FieldLabel>
              <Input id="currency" maxLength={3} {...register("currency", { required: true })} />
            </Field>
            <Field>
              <FieldLabel htmlFor="isin">ISIN (optional)</FieldLabel>
              <Input id="isin" maxLength={12} {...register("isin")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="country">Country (optional)</FieldLabel>
              <Input id="country" maxLength={2} placeholder="US, NL…" {...register("country")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="sector">Sector (optional)</FieldLabel>
              <Input id="sector" {...register("sector")} />
            </Field>
            <Field>
              <FieldLabel htmlFor="currentPrice">Current price (optional)</FieldLabel>
              <Input id="currentPrice" inputMode="decimal" {...register("currentPrice")} />
            </Field>
          </div>

          {serverError && <FieldError>{serverError}</FieldError>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Add security"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
