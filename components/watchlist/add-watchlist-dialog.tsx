"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SecuritySearchField, type SelectedSecurity } from "@/components/transactions/security-search-field";

interface AddWatchlistDialogProps {
  existingSecurities: SelectedSecurity[];
  /** Tickers already on the watchlist — offered again in the search
   * results, but selecting one is a no-op rather than a duplicate row. */
  watchedSecurityIds: Set<string>;
}

export function AddWatchlistDialog({ existingSecurities, watchedSecurityIds }: AddWatchlistDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSelect(security: SelectedSecurity) {
    if (watchedSecurityIds.has(security.id)) {
      toast.info(`${security.ticker} is already on your watchlist`);
      setOpen(false);
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ securityId: security.id }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to add to watchlist");
        return;
      }
      toast.success(`${security.ticker} added to watchlist`);
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Plus className="size-4" />
        Add to watchlist
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to watchlist</DialogTitle>
        </DialogHeader>
        <SecuritySearchField
          existingSecurities={existingSecurities}
          value={null}
          onSelect={handleSelect}
          disabled={submitting}
        />
      </DialogContent>
    </Dialog>
  );
}
