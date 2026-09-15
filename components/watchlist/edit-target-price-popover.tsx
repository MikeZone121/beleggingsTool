"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface EditTargetPricePopoverProps {
  id: string;
  ticker: string;
  currency: string;
  targetPrice: string | null;
}

export function EditTargetPricePopover({ id, ticker, currency, targetPrice }: EditTargetPricePopoverProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(targetPrice ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function save(nextValue: string | null) {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/watchlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetPrice: nextValue }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to update target price");
        return;
      }
      toast.success(nextValue ? `${ticker} target set` : `${ticker} target cleared`);
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant={targetPrice ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={`Set ${ticker} price target`}
          />
        }
      >
        <Target className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="flex flex-col gap-2">
          <label htmlFor={`target-${id}`} className="text-xs text-muted-foreground">
            Alert when price drops to or below ({currency})
          </label>
          <Input
            id={`target-${id}`}
            inputMode="decimal"
            placeholder="e.g. 45.00"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => save(value)} disabled={submitting || !value}>
              {submitting ? "Saving…" : "Save"}
            </Button>
            {targetPrice && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setValue("");
                  save(null);
                }}
                disabled={submitting}
              >
                Clear
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
