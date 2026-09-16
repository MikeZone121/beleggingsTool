/**
 * The index a portfolio is compared against on the Analytics page.
 *
 * SPDR MSCI ACWI IMI UCITS ETF on Borsa Italiana — EUR-quoted, and broader
 * than a developed-markets MSCI World (it includes emerging markets and
 * small caps). Quoted in EUR on purpose: a USD-listed equivalent folds
 * USD/EUR moves into the comparison and makes the portfolio look like it
 * beat or trailed the index on currency alone.
 *
 * Used only when `Portfolio.benchmarkTicker` is null, so changing this
 * also moves every portfolio that never picked its own benchmark.
 */
export const DEFAULT_BENCHMARK_TICKER = "IMIE.MI";

export interface BenchmarkPreset {
  ticker: string;
  label: string;
  /** Why someone would pick this one, shown beside it in Settings. */
  description: string;
}

/**
 * Shortcuts offered in Settings. Not a closed list — the field accepts any
 * ticker the configured provider resolves — but picking a benchmark is
 * exactly the kind of decision where a handful of sane, currency-matched
 * options beats a blank text box.
 *
 * Every ticker here was verified to resolve with a quote through the Yahoo
 * provider; all but the two USD-listed ones are EUR-quoted, which is what
 * a EUR-based portfolio wants (see the note on the default above).
 */
export const BENCHMARK_PRESETS: BenchmarkPreset[] = [
  {
    ticker: "IMIE.MI",
    label: "MSCI ACWI IMI (EUR)",
    description: "Whole investable world — developed + emerging, incl. small caps",
  },
  {
    ticker: "IWDA.AS",
    label: "MSCI World (EUR, Amsterdam)",
    description: "Developed markets only — the most common core benchmark",
  },
  {
    ticker: "VWCE.DE",
    label: "FTSE All-World (EUR, Xetra)",
    description: "Developed + emerging, large and mid cap",
  },
  {
    ticker: "CSPX.AS",
    label: "S&P 500 (EUR, Amsterdam)",
    description: "US large caps — for a US-heavy portfolio",
  },
  {
    ticker: "EMIM.AS",
    label: "MSCI Emerging Markets IMI (EUR)",
    description: "Emerging markets only",
  },
  {
    ticker: "AGGH.MI",
    label: "Global Aggregate Bond, EUR-hedged",
    description: "Global bonds — for a bond-heavy or defensive portfolio",
  },
  {
    ticker: "SPY",
    label: "S&P 500 (USD)",
    description: "USD-quoted — adds USD/EUR moves to the comparison",
  },
];
