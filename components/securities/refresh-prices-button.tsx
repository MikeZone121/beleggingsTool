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
      const { provider, updated, failed, skipped } = result.data;
      if (provider === "manual") {
        toast.info("No market-data provider configured — prices are entered manually.");
      } else if (failed > 0) {
        toast.warning(`Updated ${updated}, ${failed} failed, ${skipped} skipped`);
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
