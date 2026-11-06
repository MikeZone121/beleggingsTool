"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import Decimal from "decimal.js";
import { GitBranch, Plus, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils/format";
import { useLocale } from "@/components/locale-provider";

export interface SplitRow {
  id: string;
  securityId: string;
  ticker: string;
  name: string;
  /** ISO date — rendered in the user's locale. */
  effectiveDate: string;
  /** The multiplier, as stored ("10", "0.1"). */
  ratio: string;
  isReverse: boolean;
  source: string;
}

interface SecurityOption {
  id: string;
  ticker: string;
  name: string;
}

interface FormValues {
  securityId: string;
  effectiveDate: string;
  /** "10 new shares for 1 old" — the two numbers an announcement states,
   * rather than the 0.1 a reverse split would otherwise need typed. */
  newShares: string;
  oldShares: string;
}

const defaultValues: FormValues = {
  securityId: "",
  effectiveDate: new Date().toISOString().slice(0, 10),
  newShares: "",
  oldShares: "1",
};

/** "10" -> "10-for-1", "0.1" -> "1-for-10" — the form an announcement uses,
 * reconstructed from the stored multiplier. */
function describeRatio(ratio: string): string {
  try {
    const value = new Decimal(ratio);
    if (value.greaterThanOrEqualTo(1)) {
      return `${value.toString()}-for-1`;
    }
    return `1-for-${new Decimal(1).dividedBy(value).toDecimalPlaces(6).toString()}`;
  } catch {
    return ratio;
  }
}

/**
 * Review surface for share splits — the one corporate action the
 * cost-basis ledger applies. It is deliberately a *review* list rather
 * than a silent background job: whether a split should be applied depends
 * on something only the user knows, namely whether their recorded
 * quantities are pre- or post-split (a broker that restated old trades in
 * its export has already baked it in). So every split is listed with its
 * source and can be deleted individually.
 */
export function CorporateActionsCard({
  splits,
  securities,
  providerSupportsSync,
}: {
  splits: SplitRow[];
  securities: SecurityOption[];
  providerSupportsSync: boolean;
}) {
  const router = useRouter();
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ defaultValues });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    let ratio: string;
    try {
      const newShares = new Decimal(values.newShares.replace(",", "."));
      const oldShares = new Decimal(values.oldShares.replace(",", "."));
      if (!newShares.greaterThan(0) || !oldShares.greaterThan(0)) {
        setServerError("Both share counts must be greater than 0");
        return;
      }
      ratio = newShares.dividedBy(oldShares).toString();
    } catch {
      setServerError("Both share counts must be valid numbers");
      return;
    }

    const response = await fetch("/api/corporate-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        securityId: values.securityId,
        effectiveDate: values.effectiveDate,
        ratio,
      }),
    });
    const result = await response.json();
    if (!response.ok) {
      const firstDetail = Object.values(result.error?.details ?? {})[0] as string[] | undefined;
      setServerError(firstDetail?.[0] ?? result.error?.message ?? "Failed to save split");
      return;
    }

    toast.success("Split recorded");
    reset(defaultValues);
    setOpen(false);
    router.refresh();
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const response = await fetch(`/api/corporate-actions/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error?.message ?? "Failed to delete split");
        return;
      }
      toast.success("Split removed");
      router.refresh();
    });
  }

  async function handleSync() {
    setSyncing(true);
    try {
      const response = await fetch("/api/corporate-actions/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to sync splits");
        return;
      }
      const { splitsWritten, failed, errors } = result.data as {
        splitsWritten: number;
        failed: number;
        errors: Array<{ ticker: string; message: string }>;
      };
      if (failed > 0) {
        console.error("Split sync failures:", errors);
        const preview = errors
          .slice(0, 3)
          .map((e) => `${e.ticker}: ${e.message}`)
          .join("\n");
        toast.warning(`${splitsWritten} split(s) found, ${failed} failed`, {
          description: errors.length > 3 ? `${preview}\n…and ${errors.length - 3} more` : preview,
          duration: 15000,
        });
      } else if (splitsWritten === 0) {
        toast.info("No splits found for your holdings");
      } else {
        toast.success(`${splitsWritten} split${splitsWritten === 1 ? "" : "s"} recorded — review them below`);
      }
      router.refresh();
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm shadow-black/5">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border p-3">
        <div className="flex items-center gap-2">
          <GitBranch className="size-4 text-muted-foreground" />
          <h2 className="text-sm font-medium">Share splits</h2>
          <span className="text-xs text-muted-foreground">
            {splits.length} recorded · applied to quantity and cost basis
          </span>
        </div>
        <div className="flex items-center gap-2">
          {providerSupportsSync && (
            <Button variant="outline" size="sm" onClick={handleSync} disabled={syncing}>
              <RefreshCw className={syncing ? "size-3.5 animate-spin" : "size-3.5"} />
              {syncing ? "Syncing…" : "Sync from provider"}
            </Button>
          )}
          <Dialog
            open={open}
            onOpenChange={(next) => {
              setOpen(next);
              if (!next) setServerError(null);
            }}
          >
            <DialogTrigger render={<Button variant="outline" size="sm" />}>
              <Plus className="size-3.5" />
              Add split
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Record a share split</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
                <Field>
                  <FieldLabel htmlFor="split-security">Security</FieldLabel>
                  <select
                    id="split-security"
                    className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                    {...register("securityId", { required: "Required" })}
                  >
                    <option value="">Select a security…</option>
                    {securities.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.ticker} — {s.name}
                      </option>
                    ))}
                  </select>
                  {errors.securityId && <FieldError>{errors.securityId.message}</FieldError>}
                </Field>

                <Field>
                  <FieldLabel htmlFor="split-date">Effective date</FieldLabel>
                  <Input id="split-date" type="date" {...register("effectiveDate", { required: true })} />
                  <FieldDescription>
                    The date the split took effect. Transactions before it are adjusted; ones after
                    it are already in post-split shares.
                  </FieldDescription>
                </Field>

                <div className="grid grid-cols-2 gap-4">
                  <Field>
                    <FieldLabel htmlFor="split-new">New shares</FieldLabel>
                    <Input
                      id="split-new"
                      inputMode="decimal"
                      placeholder="10"
                      {...register("newShares", { required: "Required" })}
                    />
                    {errors.newShares && <FieldError>{errors.newShares.message}</FieldError>}
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="split-old">for every</FieldLabel>
                    <Input
                      id="split-old"
                      inputMode="decimal"
                      placeholder="1"
                      {...register("oldShares", { required: "Required" })}
                    />
                    {errors.oldShares && <FieldError>{errors.oldShares.message}</FieldError>}
                  </Field>
                </div>
                <FieldDescription>
                  A 10-for-1 split is 10 new for every 1 old; a 1-for-10 reverse split is 1 new for
                  every 10 old. Total cost basis never changes — only the per-share figure does.
                </FieldDescription>

                {serverError && <FieldError>{serverError}</FieldError>}

                <Button type="submit">Save split</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {splits.length === 0 ? (
        <p className="p-3 text-sm text-muted-foreground">
          No splits recorded. {providerSupportsSync ? "Sync from your provider, or add one" : "Add one"}{" "}
          by hand — without it, a position that split keeps showing its pre-split quantity against
          the post-split price.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {splits.map((split) => (
            <li key={split.id} className="flex items-center justify-between gap-2 p-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium">
                  {split.ticker}
                  <Badge variant="secondary">{describeRatio(split.ratio)}</Badge>
                  {split.isReverse && <Badge variant="secondary">reverse</Badge>}
                </div>
                <div className="truncate text-xs text-muted-foreground">
                  {formatDate(split.effectiveDate, { locale })} · {split.name} · {split.source}
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="size-9 shrink-0"
                aria-label={`Remove ${split.ticker} split`}
                disabled={isPending}
                onClick={() => handleDelete(split.id)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
