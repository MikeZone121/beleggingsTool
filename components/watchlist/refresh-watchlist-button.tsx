"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RefreshWatchlistButtonProps {
  /** Nothing to refresh on an empty watchlist — the button still renders,
   * disabled, so the page layout doesn't shift once the first ticker is
   * added. */
  disabled?: boolean;
}

/**
 * Re-fetches prices *and* daily-close history for every watched ticker (see
 * refreshWatchlistMarketData). Separate from the Portfolio page's "Refresh
 * Prices" so a watchlist can be brought up to date without touching the
 * portfolio-wide refresh, which also re-reads FX rates and every traded
 * security.
 */
export function RefreshWatchlistButton({ disabled = false }: RefreshWatchlistButtonProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    setBusy(true);
    try {
      const response = await fetch("/api/watchlist/refresh", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to refresh the watchlist");
        return;
      }
      const { provider, pricesUpdated, historyUpdated, failed, errors } = result.data as {
        provider: string;
        pricesUpdated: number;
        historyUpdated: number;
        failed: number;
        errors: Array<{ ticker: string; message: string }>;
      };

      if (provider === "manual") {
        toast.info("No market-data provider configured — prices are entered manually.");
      } else if (failed > 0) {
        // Same reasoning as RefreshPricesButton: a bare count can't tell a
        // bad ticker from a rate limit, so log them all and show the first few.
        console.error("Watchlist refresh failures:", errors);
        const preview = errors
          .slice(0, 3)
          .map((e) => `${e.ticker}: ${e.message}`)
          .join("\n");
        toast.warning(`${pricesUpdated} price${pricesUpdated === 1 ? "" : "s"} updated, ${failed} failed`, {
          description: errors.length > 3 ? `${preview}\n…and ${errors.length - 3} more` : preview,
          duration: 15000,
        });
      } else if (pricesUpdated === 0 && historyUpdated === 0) {
        toast.success("Already up to date");
      } else {
        toast.success(
          `Updated ${pricesUpdated} price${pricesUpdated === 1 ? "" : "s"}` +
            (historyUpdated > 0 ? ` and ${historyUpdated} price histor${historyUpdated === 1 ? "y" : "ies"}` : "")
        );
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleClick} disabled={busy || disabled}>
      <RefreshCw className={busy ? "size-4 animate-spin" : "size-4"} />
      {busy ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
