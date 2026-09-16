"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, Check } from "lucide-react";
import Decimal from "decimal.js";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Money, Percent } from "@/components/ui/money";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MODEL_PORTFOLIOS, resolveModelPortfolioTargets } from "@/lib/finance/modelPortfolios";

export interface RebalancingRowData {
  key: string;
  label: string;
  currentWeight: string;
  targetWeight: string | null;
  targetId: string | null;
  driftWeight: string | null;
  suggestedTradeBase: string | null;
}

export interface RebalancingPlanData {
  dimension: "assetType" | "sector" | "currency";
  totalValue: string;
  totalTargetWeight: string;
  rows: RebalancingRowData[];
}

interface RebalancingCardProps {
  plans: RebalancingPlanData[];
  baseCurrency: string;
}

function DimensionTable({ plan, baseCurrency }: { plan: RebalancingPlanData; baseCurrency: string }) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const targetSum = new Decimal(plan.totalTargetWeight || 0);
  const targetsSetButOff = targetSum.greaterThan(0) && targetSum.minus(1).abs().greaterThan(0.02);

  function draftFor(row: RebalancingRowData): string {
    if (row.key in drafts) return drafts[row.key];
    return row.targetWeight ? new Decimal(row.targetWeight).times(100).toString() : "";
  }

  function clearDraft(key: string) {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function saveTarget(row: RebalancingRowData) {
    const draft = draftFor(row).trim();
    if (draft === "") {
      toast.error("Enter a percentage, or use the clear button to remove the target");
      return;
    }
    const percent = new Decimal(draft.replace(",", "."));
    if (!percent.isFinite() || percent.lessThan(0) || percent.greaterThan(100)) {
      toast.error("Enter a percentage between 0 and 100");
      return;
    }

    setSavingKey(row.key);
    try {
      const response = await fetch("/api/allocation-targets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dimension: plan.dimension,
          key: row.key,
          targetPercent: percent.dividedBy(100).toString(),
        }),
      });
      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error?.message ?? "Failed to save target");
        return;
      }
      toast.success(`Target set for ${row.label}`);
      clearDraft(row.key);
      router.refresh();
    } finally {
      setSavingKey(null);
    }
  }

  async function clearTarget(row: RebalancingRowData) {
    if (!row.targetId) {
      clearDraft(row.key);
      return;
    }
    setSavingKey(row.key);
    try {
      const response = await fetch(`/api/allocation-targets/${row.targetId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const result = await response.json();
        toast.error(result.error?.message ?? "Failed to clear target");
        return;
      }
      toast.success(`Target cleared for ${row.label}`);
      clearDraft(row.key);
      router.refresh();
    } finally {
      setSavingKey(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {targetsSetButOff && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          Targets for this dimension sum to <Percent value={targetSum.toString()} /> — suggested
          trades below assume they add up to 100%.
        </p>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Bucket</TableHead>
            <TableHead className="text-right">Current</TableHead>
            <TableHead className="text-right">Target %</TableHead>
            <TableHead className="text-right">Drift</TableHead>
            <TableHead className="text-right">Suggested</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {plan.rows.map((row) => {
            const drift = row.driftWeight ? new Decimal(row.driftWeight) : null;
            const tone = drift
              ? drift.greaterThan(0)
                ? "text-emerald-600 dark:text-emerald-400"
                : drift.lessThan(0)
                  ? "text-red-600 dark:text-red-400"
                  : ""
              : "";
            return (
              <TableRow key={row.key}>
                <TableCell className="font-medium">{row.label}</TableCell>
                <TableCell className="text-right tabular-nums">
                  <Percent value={row.currentWeight} />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Input
                      inputMode="decimal"
                      value={draftFor(row)}
                      onChange={(e) => setDrafts((prev) => ({ ...prev, [row.key]: e.target.value }))}
                      placeholder="—"
                      className="h-7 w-16 text-right tabular-nums"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Save target for ${row.label}`}
                      disabled={savingKey === row.key}
                      onClick={() => saveTarget(row)}
                    >
                      <Check className="size-3.5" />
                    </Button>
                    {row.targetId && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Clear target for ${row.label}`}
                        disabled={savingKey === row.key}
                        onClick={() => clearTarget(row)}
                      >
                        <X className="size-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className={`text-right tabular-nums ${tone}`}>
                  {drift ? <Percent value={drift.toString()} signDisplay="always" /> : "—"}
                </TableCell>
                <TableCell className={`text-right tabular-nums ${tone}`}>
                  {row.suggestedTradeBase ? (
                    <Money
                      value={row.suggestedTradeBase}
                      currency={baseCurrency}
                      signDisplay="always"
                    />
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

/**
 * Bulk-applies a standard growth/defensive split as Rebalancing targets
 * for the asset-type dimension — the existing Current/Target/Drift/
 * Suggested table below already *is* the "vs. model portfolio"
 * comparison, this just fills it in with one click instead of typing
 * every bucket's percentage by hand. Only meaningful for `assetType`:
 * "growth vs. defensive" has no equivalent split for sector or currency.
 */
function ModelPortfolioPresets({ heldKeys }: { heldKeys: string[] }) {
  const router = useRouter();
  const [applyingId, setApplyingId] = useState<string | null>(null);

  async function applyPreset(modelId: string) {
    const model = MODEL_PORTFOLIOS.find((m) => m.id === modelId);
    if (!model) return;

    setApplyingId(modelId);
    try {
      const targets = resolveModelPortfolioTargets(model, heldKeys);
      const results = await Promise.all(
        Object.entries(targets).map(([key, percent]) =>
          fetch("/api/allocation-targets", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dimension: "assetType", key, targetPercent: percent.toString() }),
          })
        )
      );
      if (results.some((r) => !r.ok)) {
        toast.error("Failed to apply some targets — try again");
        return;
      }
      toast.success(`Applied "${model.label}" as your target allocation`);
      router.refresh();
    } finally {
      setApplyingId(null);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Compare to a model portfolio:</span>
      {MODEL_PORTFOLIOS.map((model) => (
        <Button
          key={model.id}
          variant="outline"
          size="sm"
          title={model.description}
          disabled={applyingId !== null}
          onClick={() => applyPreset(model.id)}
        >
          {applyingId === model.id ? "Applying…" : model.label}
        </Button>
      ))}
    </div>
  );
}

export function RebalancingCard({ plans, baseCurrency }: RebalancingCardProps) {
  const byDimension = new Map(plans.map((p) => [p.dimension, p]));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Rebalancing</CardTitle>
        <p className="text-xs text-muted-foreground">
          Set a target % per bucket — a positive drift means you&apos;re underweight (room to
          buy), negative means overweight (room to sell). Suggested amounts are a one-shot
          estimate, not investment advice.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="assetType">
          <TabsList>
            <TabsTrigger value="assetType">Asset type</TabsTrigger>
            <TabsTrigger value="sector">Sector</TabsTrigger>
            <TabsTrigger value="currency">Currency</TabsTrigger>
          </TabsList>
          {(["assetType", "sector", "currency"] as const).map((dimension) => {
            const plan = byDimension.get(dimension);
            return (
              <TabsContent key={dimension} value={dimension} className="pt-4">
                {plan && plan.rows.length > 0 ? (
                  <>
                    {dimension === "assetType" && (
                      <ModelPortfolioPresets heldKeys={plan.rows.map((r) => r.key)} />
                    )}
                    <DimensionTable plan={plan} baseCurrency={baseCurrency} />
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No holdings in this dimension yet.</p>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
