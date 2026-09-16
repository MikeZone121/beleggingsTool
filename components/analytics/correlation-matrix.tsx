import type { CorrelationCell } from "@/lib/portfolio/correlationMatrixService";

interface CorrelationMatrixProps {
  tickers: string[];
  cells: CorrelationCell[];
}

function cellToneClass(correlation: number | null): string {
  if (correlation === null) return "text-muted-foreground";
  if (correlation >= 0.7) return "bg-red-500/15 text-red-700 dark:text-red-400";
  if (correlation >= 0.3) return "bg-amber-500/10 text-amber-700 dark:text-amber-400";
  if (correlation > -0.3) return "";
  return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
}

/**
 * How closely each pair of holdings' daily returns move together — the
 * Allocation card's buckets can make two holdings look like separate
 * bets (different sector, different asset type) while they actually
 * move almost in lockstep, which a correlation near +1 makes visible
 * and a pie chart can't.
 */
export function CorrelationMatrix({ tickers, cells }: CorrelationMatrixProps) {
  if (tickers.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">Need at least 2 holdings to compare correlation.</p>
    );
  }

  const cellByPair = new Map(cells.map((c) => [`${c.tickerA}|${c.tickerB}`, c.correlation]));

  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th className="p-2" />
            {tickers.map((ticker) => (
              <th key={ticker} className="p-2 text-center font-medium">
                {ticker}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {tickers.map((rowTicker) => (
            <tr key={rowTicker}>
              <th className="p-2 text-left font-medium">{rowTicker}</th>
              {tickers.map((colTicker) => {
                const correlation = cellByPair.get(`${rowTicker}|${colTicker}`) ?? null;
                return (
                  <td
                    key={colTicker}
                    className={`rounded-md p-2 text-center tabular-nums ${cellToneClass(correlation)}`}
                  >
                    {correlation === null ? "—" : correlation.toFixed(2)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
