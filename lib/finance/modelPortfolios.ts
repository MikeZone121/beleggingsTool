/**
 * Standard growth/defensive splits, applied to whichever asset-type
 * buckets the portfolio actually holds — not investment advice, just a
 * quick way to populate Rebalancing targets instead of typing each
 * bucket's percentage by hand.
 */
export interface ModelPortfolio {
  id: string;
  label: string;
  description: string;
  /** 0-1 */
  growthPercent: number;
  /** 0-1 */
  defensivePercent: number;
}

export const MODEL_PORTFOLIOS: ModelPortfolio[] = [
  {
    id: "100-0",
    label: "100% Growth",
    description: "All in stocks/ETFs/funds — maximum long-term growth, maximum volatility.",
    growthPercent: 1,
    defensivePercent: 0,
  },
  {
    id: "80-20",
    label: "80 / 20",
    description: "A common long-horizon default — mostly growth, a bond/cash cushion.",
    growthPercent: 0.8,
    defensivePercent: 0.2,
  },
  {
    id: "60-40",
    label: "60 / 40",
    description: "The classic balanced portfolio.",
    growthPercent: 0.6,
    defensivePercent: 0.4,
  },
  {
    id: "40-60",
    label: "40 / 60 Conservative",
    description: "More bonds/cash than growth — capital preservation over growth.",
    growthPercent: 0.4,
    defensivePercent: 0.6,
  },
];

/** Growth-oriented vs. defensive asset types, per `ASSET_TYPES` in
 * lib/validation/security.ts. `OTHER` is deliberately excluded from both —
 * there's no reasonable default to assign it. */
export const GROWTH_ASSET_TYPES = ["STOCK", "ETF", "FUND", "CRYPTO"] as const;
export const DEFENSIVE_ASSET_TYPES = ["BOND", "CASH"] as const;

/**
 * Splits `percent` evenly across whichever of `types` the portfolio
 * currently holds (`heldKeys`) — even, not weighted by current size, so
 * applying a preset doesn't just reinforce whatever's already over/under-
 * weighted within the group. Falls back to `fallbackKey` alone when the
 * portfolio holds none of `types` yet, so the preset still produces a
 * complete, applicable set of targets (e.g. "set up a bond target" even
 * before owning any bonds).
 */
function distributeEvenly(
  types: readonly string[],
  heldKeys: ReadonlySet<string>,
  percent: number,
  fallbackKey: string
): Record<string, number> {
  const held = types.filter((t) => heldKeys.has(t));
  const targets = held.length > 0 ? held : [fallbackKey];
  const each = percent / targets.length;
  return Object.fromEntries(targets.map((t) => [t, each]));
}

/** Resolves a model portfolio into per-asset-type target percentages
 * (0-1, summing to 1), given the asset types this portfolio currently
 * holds any value in. */
export function resolveModelPortfolioTargets(
  model: ModelPortfolio,
  heldAssetTypeKeys: string[]
): Record<string, number> {
  const heldKeys = new Set(heldAssetTypeKeys);
  return {
    ...distributeEvenly(GROWTH_ASSET_TYPES, heldKeys, model.growthPercent, "STOCK"),
    ...distributeEvenly(DEFENSIVE_ASSET_TYPES, heldKeys, model.defensivePercent, "CASH"),
  };
}
