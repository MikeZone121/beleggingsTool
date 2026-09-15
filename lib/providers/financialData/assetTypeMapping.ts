import type { ASSET_TYPES } from "@/lib/validation/security";

type AssetType = (typeof ASSET_TYPES)[number];

/** Best-effort mapping from a provider's free-text instrument type to our
 * `AssetType` enum — providers use inconsistent vocabularies, so this is
 * a suggestion the user can override, never applied silently to stored data
 * without going through the normal "Add security" form. */
export function mapProviderAssetType(raw: string | null): AssetType {
  if (!raw) return "OTHER";
  const normalized = raw.toLowerCase();

  if (normalized.includes("etf")) return "ETF";
  if (normalized.includes("fund") || normalized.includes("trust")) return "FUND";
  if (normalized.includes("bond")) return "BOND";
  if (normalized.includes("crypto")) return "CRYPTO";
  if (normalized.includes("stock") || normalized.includes("equity") || normalized.includes("reit")) {
    return "STOCK";
  }
  return "OTHER";
}
