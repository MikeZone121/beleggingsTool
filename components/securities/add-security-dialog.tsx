"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FieldDescription, FieldError } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { mapProviderAssetType } from "@/lib/providers/financialData/assetTypeMapping";
import {
  SecurityFormFields,
  toSecurityPayload,
  type SecurityFormValues,
} from "./security-form-fields";

interface SearchResult {
  ticker: string;
  name: string;
  exchange: string | null;
  currency: string;
  country: string | null;
  assetType: string | null;
}

type FormValues = SecurityFormValues;

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
    setValue,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues });

  const [query, setQuery] = useState("");
  const [rawResults, setRawResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Below the 2-character threshold there's nothing to show — derived
  // directly from `query` rather than cleared via a synchronous setState in
  // the effect below (React flags that pattern as cascading-render-prone).
  const results = query.trim().length < 2 ? [] : rawResults;

  useEffect(() => {
    if (query.trim().length < 2) return;

    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/securities/search?q=${encodeURIComponent(query)}`);
        const result = await response.json();
        setRawResults(response.ok ? result.data : []);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  function applySearchResult(result: SearchResult) {
    setValue("ticker", result.ticker);
    setValue("name", result.name);
    setValue("exchange", result.exchange ?? "");
    setValue("currency", result.currency);
    setValue("country", result.country ?? "");
    setValue("assetType", mapProviderAssetType(result.assetType));
    setRawResults([]);
    setQuery("");
  }

  async function onSubmit(values: FormValues) {
    setSubmitting(true);
    setServerError(null);
    try {
      const response = await fetch("/api/securities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toSecurityPayload(values)),
      });
      const result = await response.json();

      if (!response.ok) {
        const firstDetail = Object.values(result.error?.details ?? {})[0] as
          | string[]
          | undefined;
        setServerError(firstDetail?.[0] ?? result.error?.message ?? "Failed to create security");
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
        <div className="flex flex-col gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search by ticker or name…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {searching && <FieldDescription>Searching…</FieldDescription>}
          {results.length > 0 && (
            <ul className="max-h-40 overflow-auto rounded-lg border">
              {results.map((r) => (
                <li key={`${r.ticker}-${r.exchange}`}>
                  <button
                    type="button"
                    onClick={() => applySearchResult(r)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted"
                  >
                    <span className="font-medium">
                      {r.ticker} — {r.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {r.exchange ?? "—"} · {r.currency}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <SecurityFormFields register={register} errors={errors} idPrefix="add-security" />

          {serverError && <FieldError>{serverError}</FieldError>}

          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Add security"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
