"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RefreshAllSummary {
  provider: string;
  prices: { updated: number; failed: number; skipped: number };
  priceHistory: { updated: number; failed: number; skipped: number };
  errors: Array<{ step: string; ticker: string; message: string }>;
}

export function RefreshAllButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const response = await fetch("/api/refresh-all", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to refresh");
        return;
      }
      const summary = result.data as RefreshAllSummary;

      if (summary.provider === "manual") {
        toast.info("No market-data provider configured — nothing to refresh.");
        return;
      }

      const totalFailed = summary.prices.failed + summary.priceHistory.failed;

      const parts = [`${summary.prices.updated} prices`];
      if (summary.priceHistory.updated > 0) parts.push(`${summary.priceHistory.updated} price histories`);

      if (totalFailed > 0) {
        console.error("Refresh All failures:", summary.errors);
        const preview = summary.errors
          .slice(0, 3)
          .map((e) => `[${e.step}] ${e.ticker}: ${e.message}`)
          .join("\n");
        toast.warning(`Updated ${parts.join(", ")} — ${totalFailed} failed`, {
          description:
            summary.errors.length > 3 ? `${preview}\n…and ${summary.errors.length - 3} more` : preview,
          duration: 15000,
        });
      } else {
        toast.success(`Refreshed everything: ${parts.join(", ")}`);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={busy}>
      <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
      {busy ? "Refreshing everything…" : "Refresh All"}
    </Button>
  );
}
