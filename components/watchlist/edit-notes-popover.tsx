"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface EditNotesPopoverProps {
  id: string;
  ticker: string;
  notes: string | null;
}

export function EditNotesPopover({ id, ticker, notes }: EditNotesPopoverProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(notes ?? "");
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    try {
      const response = await fetch(`/api/watchlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes: value }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error?.message ?? "Failed to save note");
        return;
      }
      toast.success(`${ticker} note saved`);
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
            variant={notes ? "secondary" : "ghost"}
            size="icon-sm"
            aria-label={`Edit ${ticker} note`}
          />
        }
      >
        <StickyNote className="size-3.5" />
      </PopoverTrigger>
      <PopoverContent className="w-64" align="end">
        <div className="flex flex-col gap-2">
          <label htmlFor={`note-${id}`} className="text-xs text-muted-foreground">
            Why are you watching {ticker}?
          </label>
          <textarea
            id={`note-${id}`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. wait for it to drop below €40"
            rows={3}
            maxLength={500}
            autoFocus
            className="w-full resize-none rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          <Button size="sm" onClick={save} disabled={submitting}>
            {submitting ? "Saving…" : "Save"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
