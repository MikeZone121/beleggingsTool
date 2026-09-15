"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, Check, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { mapProviderAssetType } from "@/lib/providers/financialData/assetTypeMapping";

export interface SelectedSecurity {
  id: string;
  ticker: string;
  name: string;
  currency: string;
}

type ExistingSecurity = SelectedSecurity;

interface ProviderResult {
  ticker: string;
  name: string;
  exchange: string | null;
  currency: string;
  country: string | null;
  assetType: string | null;
}

interface SecuritySearchFieldProps {
  existingSecurities: ExistingSecurity[];
  value: SelectedSecurity | null;
  onSelect: (security: SelectedSecurity) => void;
  disabled?: boolean;
}

/**
 * Lets a user pick a security by ticker/name search while adding a
 * transaction — no detour through a separate "Add security" step first.
 * Existing (already-in-portfolio) matches are selected directly; a match
 * that only exists in the market-data provider is created (POST
 * /api/securities) on selection, then used immediately. With the default
 * "manual" provider, only existing securities show up — same as before.
 */
export function SecuritySearchField({
  existingSecurities,
  value,
  onSelect,
  disabled,
}: SecuritySearchFieldProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rawProviderResults, setRawProviderResults] = useState<ProviderResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [creatingTicker, setCreatingTicker] = useState<string | null>(null);

  // Below the 2-character threshold there's nothing to show — derived
  // directly from `query` rather than cleared via a synchronous setState in
  // the effect below (React flags that pattern as cascading-render-prone).
  const providerResults = query.trim().length < 2 ? [] : rawProviderResults;

  useEffect(() => {
    if (query.trim().length < 2) return;

    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/securities/search?q=${encodeURIComponent(query)}`);
        const result = await response.json();
        setRawProviderResults(response.ok ? result.data : []);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  const q = query.trim().toLowerCase();
  const matchingExisting =
    q.length === 0
      ? []
      : existingSecurities.filter(
          (s) => s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)
        );
  const existingTickers = new Set(existingSecurities.map((s) => s.ticker.toUpperCase()));
  const newProviderResults = providerResults.filter(
    (r) => !existingTickers.has(r.ticker.toUpperCase())
  );

  async function handleSelectExisting(security: ExistingSecurity) {
    onSelect(security);
    setQuery("");
    setOpen(false);
  }

  async function handleSelectNew(result: ProviderResult) {
    setCreatingTicker(result.ticker);
    try {
      const response = await fetch("/api/securities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: result.ticker,
          name: result.name,
          assetType: mapProviderAssetType(result.assetType),
          exchange: result.exchange,
          currency: result.currency,
          country: result.country,
          sector: null,
          currentPrice: null,
        }),
      });
      const created = await response.json();
      if (!response.ok) {
        const firstDetail = Object.values(created.error?.details ?? {})[0] as
          | string[]
          | undefined;
        toast.error(firstDetail?.[0] ?? created.error?.message ?? "Failed to add security");
        return;
      }
      toast.success(`${result.ticker} added`);
      onSelect({
        id: created.data.id,
        ticker: created.data.ticker,
        name: created.data.name,
        currency: created.data.currency,
      });
      setQuery("");
      setOpen(false);
    } finally {
      setCreatingTicker(null);
    }
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder={value ? `${value.ticker} — ${value.name}` : "Search by ticker or name…"}
          value={query}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>

      {open && q.length >= 2 && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border bg-popover shadow-md">
          {matchingExisting.length === 0 && newProviderResults.length === 0 && !searching && (
            <p className="p-3 text-sm text-muted-foreground">No matches.</p>
          )}
          {searching && <p className="p-3 text-sm text-muted-foreground">Searching…</p>}

          {matchingExisting.map((s) => (
            <button
              key={s.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectExisting(s)}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span>
                <span className="font-medium">{s.ticker}</span> — {s.name}
              </span>
              {value?.id === s.id && <Check className="size-4 shrink-0 text-primary" />}
            </button>
          ))}

          {newProviderResults.map((r) => (
            <button
              key={`${r.ticker}-${r.exchange}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelectNew(r)}
              disabled={creatingTicker === r.ticker}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                <Plus className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="font-medium">{r.ticker}</span> — {r.name}
              </span>
              <span className="pl-5 text-xs text-muted-foreground">
                {creatingTicker === r.ticker
                  ? "Adding…"
                  : `${r.exchange ?? "—"} · ${r.currency} · not yet in your portfolio`}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
