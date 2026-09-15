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
