"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface EditPricePopoverProps {
  securityId: string;
  ticker: string;
  currency: string;
  currentPrice: string | null;
}

export function EditPricePopover({ securityId, ticker, currency, currentPrice }: EditPricePopoverProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(currentPrice ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function handleSave() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/securities/${securityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPrice: value }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to update price");
        return;
      }
      toast.success(`${ticker} price updated`);
      setOpen(false);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label={`Edit ${ticker} price`} />}
      >
        <Pencil className="size-3" />
      </PopoverTrigger>
      <PopoverContent className="w-56" align="end">
        <div className="flex flex-col gap-2">
          <label htmlFor={`price-${securityId}`} className="text-xs text-muted-foreground">
            Current price ({currency})
          </label>
          <Input
            id={`price-${securityId}`}
            inputMode="decimal"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <Button size="sm" onClick={handleSave} disabled={submitting || !value}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
