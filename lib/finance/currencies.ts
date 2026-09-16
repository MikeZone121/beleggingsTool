export interface CurrencyOption {
  code: string;
  label: string;
}

/**
 * Base-currency choices offered in Settings. Not a validation whitelist —
 * `portfolioSettingsSchema` accepts any 3-letter ISO code, since the FX
 * layer works off whatever pairs the provider resolves — just the set worth
 * putting in a dropdown for a European investor rather than listing every
 * ISO 4217 code.
 */
export const COMMON_CURRENCIES: CurrencyOption[] = [
  { code: "EUR", label: "Euro" },
  { code: "USD", label: "US Dollar" },
  { code: "GBP", label: "Pound Sterling" },
  { code: "CHF", label: "Swiss Franc" },
  { code: "SEK", label: "Swedish Krona" },
  { code: "NOK", label: "Norwegian Krone" },
  { code: "DKK", label: "Danish Krone" },
  { code: "PLN", label: "Polish Zloty" },
  { code: "CZK", label: "Czech Koruna" },
  { code: "CAD", label: "Canadian Dollar" },
  { code: "AUD", label: "Australian Dollar" },
  { code: "JPY", label: "Japanese Yen" },
];
