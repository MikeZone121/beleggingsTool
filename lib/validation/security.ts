import { z } from "zod";
import { positiveDecimalString } from "./decimal";

export const ASSET_TYPES = [
  "STOCK",
  "ETF",
  "FUND",
  "BOND",
  "CASH",
  "CRYPTO",
  "OTHER",
] as const;

export const assetTypeSchema = z.enum(ASSET_TYPES);

export const securityInputSchema = z.object({
  ticker: z.string().trim().min(1).max(20).toUpperCase(),
  name: z.string().trim().min(1).max(200),
  isin: z.string().trim().length(12).optional().nullable(),
  assetType: assetTypeSchema,
  exchange: z.string().trim().max(50).optional().nullable(),
  currency: z.string().length(3).toUpperCase(),
  // Accepts either an ISO-2 code (manual entry) or a full country name
  // (Twelve Data's symbol search returns e.g. "United States", not "US").
  country: z.string().trim().max(60).optional().nullable(),
  sector: z.string().trim().max(100).optional().nullable(),
  currentPrice: positiveDecimalString.optional().nullable(),
});

export type SecurityInput = z.infer<typeof securityInputSchema>;

/**
 * PATCH counterpart: every field optional, so a caller can send just the
 * one it changed. `.partial()` over the create schema deliberately, rather
 * than a hand-written second schema — a field added to `securityInput`
 * then can't be silently un-editable.
 *
 * `currentPrice` keeps its `positiveDecimalString` rule, which is why the
 * price-only PATCH the Portfolio table's pencil sends (`{ currentPrice }`)
 * still validates exactly as before.
 */
export const securityUpdateSchema = securityInputSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field must be provided"
);

export type SecurityUpdateInput = z.infer<typeof securityUpdateSchema>;
