"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncPriceHistoryButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const response = await fetch("/api/prices/sync", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to sync price history");
        return;
      }
      const { provider, updated, failed, skipped, errors } = result.data as {
        provider: string;
        updated: number;
        failed: number;
        skipped: number;
        errors: Array<{ ticker: string; message: string }>;
      };
      if (provider === "manual") {
        toast.info("No market-data provider configured — price history can't be synced.");
      } else if (failed > 0) {
        console.error("Price history sync failures:", errors);
        const preview = errors
          .slice(0, 3)
          .map((e) => `${e.ticker}: ${e.message}`)
          .join("\n");
        toast.warning(`Synced ${updated}, ${failed} failed, ${skipped} skipped`, {
          description: errors.length > 3 ? `${preview}\n…and ${errors.length - 3} more` : preview,
          duration: 15000,
        });
      } else {
        toast.success(`Synced price history for ${updated} security${updated === 1 ? "" : "ies"}`);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={busy}>
      <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
      {busy ? "Syncing…" : "Sync Price History"}
    </Button>
  );
}
