import { z } from "zod";
import { fractionString } from "./decimal";

export const ALLOCATION_DIMENSIONS = ["assetType", "sector", "country", "currency"] as const;

export const allocationTargetInputSchema = z.object({
  dimension: z.enum(ALLOCATION_DIMENSIONS),
  key: z.string().min(1).max(100),
  targetPercent: fractionString,
});

export type AllocationTargetInput = z.infer<typeof allocationTargetInputSchema>;
