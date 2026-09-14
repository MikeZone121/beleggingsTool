import { z } from "zod";
import Decimal from "decimal.js";

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

const decimalString = z
  .string()
  .trim()
  .min(1)
  .refine((val) => {
    try {
      return new Decimal(val).isFinite();
    } catch {
      return false;
    }
  }, "Must be a valid number");

export const securityInputSchema = z.object({
  ticker: z.string().trim().min(1).max(20).toUpperCase(),
  name: z.string().trim().min(1).max(200),
  isin: z.string().trim().length(12).optional().nullable(),
  assetType: assetTypeSchema,
  exchange: z.string().trim().max(50).optional().nullable(),
  currency: z.string().length(3).toUpperCase(),
  country: z.string().trim().max(2).optional().nullable(),
  sector: z.string().trim().max(100).optional().nullable(),
  currentPrice: decimalString.optional().nullable(),
});

export type SecurityInput = z.infer<typeof securityInputSchema>;
