import { z } from "zod";

export const portfolioInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  baseCurrency: z.string().length(3).toUpperCase(),
});

export type PortfolioInput = z.infer<typeof portfolioInputSchema>;

export const accountInputSchema = z.object({
  portfolioId: z.string().min(1),
  name: z.string().trim().min(1).max(100),
  brokerName: z.string().trim().max(100).optional().nullable(),
  accountNumberMasked: z.string().trim().max(30).optional().nullable(),
  currency: z.string().length(3).toUpperCase(),
});

export type AccountInput = z.infer<typeof accountInputSchema>;
