"use client";

import { useEffect, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ProviderResult {
  ticker: string;
  name: string;
  exchange: string | null;
  currency: string;
}

interface TickerSearchFieldProps {
  placeholder?: string;
  onSelect: (ticker: string) => void;
}

/**
 * A lighter cousin of `SecuritySearchField` (transactions) — same
 * provider-backed search, but for picking any ticker to compare against
 * rather than one to add to the portfolio, so there's no "create this
 * security" step on selection.
 */
export function TickerSearchField({ placeholder, onSelect }: TickerSearchFieldProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [rawResults, setResults] = useState<ProviderResult[]>([]);
  const [searching, setSearching] = useState(false);

  // Below the 2-character threshold there's nothing to show — derived
  // directly from `query` rather than cleared via a synchronous setState in
  // the effect below (React flags that pattern as cascading-render-prone).
  const results = query.trim().length < 2 ? [] : rawResults;

  useEffect(() => {
    if (query.trim().length < 2) return;

    const handle = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/securities/search?q=${encodeURIComponent(query)}`);
        const result = await response.json();
        setResults(response.ok ? result.data : []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(handle);
  }, [query]);

  function handlePick(result: ProviderResult) {
    onSelect(result.ticker);
    setQuery("");
    setResults([]);
    setOpen(false);
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="h-8 w-40 pl-7"
          placeholder={placeholder ?? "Search ticker…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute z-10 mt-1 max-h-64 w-64 overflow-auto rounded-lg border bg-popover shadow-md">
          {searching && <p className="p-3 text-sm text-muted-foreground">Searching…</p>}
          {!searching && results.length === 0 && (
            <p className="p-3 text-sm text-muted-foreground">No matches.</p>
          )}
          {results.map((r) => (
            <button
              key={`${r.ticker}-${r.exchange}`}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handlePick(r)}
              className="flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left text-sm hover:bg-muted"
            >
              <span className="font-medium">{r.ticker}</span>
              <span className="text-xs text-muted-foreground">
                {r.name} — {r.exchange ?? "—"} · {r.currency}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
