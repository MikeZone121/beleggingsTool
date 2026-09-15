"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshPricesButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const response = await fetch("/api/securities/refresh-prices", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to refresh prices");
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
        toast.info("No market-data provider configured — prices are entered manually.");
      } else if (failed > 0) {
        // Counts alone ("13 failed") give no way to tell a bad ticker from a
        // rate limit from a genuine provider outage — log every failure so
        // it's actually diagnosable from the browser console, and surface
        // the first few directly in the toast.
        console.error("Price refresh failures:", errors);
        const preview = errors
          .slice(0, 3)
          .map((e) => `${e.ticker}: ${e.message}`)
          .join("\n");
        toast.warning(`Updated ${updated}, ${failed} failed, ${skipped} skipped`, {
          description: errors.length > 3 ? `${preview}\n…and ${errors.length - 3} more` : preview,
          duration: 15000,
        });
      } else {
        toast.success(`Updated ${updated} price${updated === 1 ? "" : "s"}`);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={busy}>
      <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
      {busy ? "Refreshing…" : "Refresh Prices"}
    </Button>
  );
}
