"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncDividendsButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const response = await fetch("/api/dividends/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to sync dividend history");
        return;
      }
      const { provider, updated, failed, skipped, errors, transactions } = result.data as {
        provider: string;
        updated: number;
        failed: number;
        skipped: number;
        errors: Array<{ ticker: string; message: string }>;
        transactions: { created: number; failed: number; skippedAmbiguousAccount: number };
      };
      if (provider === "manual") {
        toast.info("No market-data provider configured — dividend history can't be synced.");
      } else if (failed > 0) {
        console.error("Dividend sync failures:", errors);
        const preview = errors
          .slice(0, 3)
          .map((e) => `${e.ticker}: ${e.message}`)
          .join("\n");
        toast.warning(`Synced ${updated}, ${failed} failed, ${skipped} skipped`, {
          description: errors.length > 3 ? `${preview}\n…and ${errors.length - 3} more` : preview,
          duration: 15000,
        });
      } else if (transactions.created > 0) {
        toast.success(
          `Synced ${updated} securit${updated === 1 ? "y" : "ies"} — added ${transactions.created} dividend transaction${transactions.created === 1 ? "" : "s"} from confirmed payouts`
        );
      } else {
        toast.success(`Synced dividend history for ${updated} security${updated === 1 ? "" : "ies"}`);
      }
      if (transactions.failed > 0) {
        console.error(
          `${transactions.failed} auto-dividend transaction(s) failed to create`,
          transactions
        );
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={busy}>
      <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
      {busy ? "Syncing…" : "Sync Dividend History"}
    </Button>
  );
}
