import { z } from "zod";
import { fractionString, nonNegativeDecimalString } from "./decimal";

/** The locales offered in Settings. A closed list rather than free text:
 * every value is passed straight to `Intl`, which silently falls back to
 * the default locale on an unrecognised tag instead of erroring, so a typo
 * would look like the setting simply didn't save. */
export const SUPPORTED_LOCALES = ["en-US", "en-GB", "nl-BE", "nl-NL", "fr-BE", "de-DE"] as const;

export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const LOCALE_LABEL: Record<SupportedLocale, string> = {
  "en-US": "English (US)",
  "en-GB": "English (UK)",
  "nl-BE": "Nederlands (België)",
  "nl-NL": "Nederlands (Nederland)",
  "fr-BE": "Français (Belgique)",
  "de-DE": "Deutsch (Deutschland)",
};

export const profileSettingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  locale: z.enum(SUPPORTED_LOCALES),
});

export type ProfileSettingsInput = z.infer<typeof profileSettingsSchema>;

export const portfolioSettingsSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  baseCurrency: z
    .string()
    .trim()
    .length(3, "Use a 3-letter ISO currency code")
    .toUpperCase(),
  /** Empty input means "use the app default" — stored as null rather than
   * an empty string so the fallback in the Analytics page stays a simple
   * null check. */
  benchmarkTicker: z
    .string()
    .trim()
    .max(20)
    .transform((value) => (value.length === 0 ? null : value.toUpperCase()))
    .nullable(),
  dividendTaxRate: fractionString,
  capitalGainsTaxRate: fractionString,
  /** In the portfolio's base currency, not necessarily EUR — see
   * lib/finance/capitalGainsTax.ts. */
  capitalGainsExemption: nonNegativeDecimalString,
});

export type PortfolioSettingsInput = z.infer<typeof portfolioSettingsSchema>;
