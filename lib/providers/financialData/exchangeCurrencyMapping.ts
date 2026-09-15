/**
 * Yahoo Finance's `/v1/finance/search` endpoint (unlike its `/v8/finance/chart`
 * endpoint) doesn't return a currency — only a short exchange code. This is a
 * best-effort code → currency guess so the "Add security" form has something
 * to pre-fill; like `mapProviderAssetType`, it's a suggestion the user can
 * always override in the form, never applied silently to stored data.
 */
const EXCHANGE_CURRENCY: Record<string, string> = {
  // United States
  NMS: "USD",
  NYQ: "USD",
  NGM: "USD",
  NCM: "USD",
  PCX: "USD",
  ASE: "USD",
  BTS: "USD",
  PNK: "USD",
  // Canada
  TOR: "CAD",
  VAN: "CAD",
  // Eurozone
  AMS: "EUR",
  BRU: "EUR",
  PAR: "EUR",
  GER: "EUR",
  FRA: "EUR",
  DUS: "EUR",
  MUN: "EUR",
  STU: "EUR",
  HAM: "EUR",
  BER: "EUR",
  MIL: "EUR",
  MCE: "EUR",
  LIS: "EUR",
  VIE: "EUR",
  IRE: "EUR",
  HEL: "EUR",
  ATH: "EUR",
  // Other Europe
  LSE: "GBP",
  IOB: "GBP",
  SWX: "CHF",
  EBS: "CHF",
  STO: "SEK",
  CPH: "DKK",
  OSL: "NOK",
  WSE: "PLN",
  IST: "TRY",
  // Asia-Pacific
  ASX: "AUD",
  HKG: "HKD",
  SHH: "CNY",
  SHZ: "CNY",
  TYO: "JPY",
  JPX: "JPY",
  SES: "SGD",
  NSE: "INR",
  BSE: "INR",
  KRX: "KRW",
  KSC: "KRW",
  TAI: "TWD",
  TWO: "TWD",
  JKT: "IDR",
  KLS: "MYR",
  SET: "THB",
  // Other
  SAO: "BRL",
  MEX: "MXN",
  JNB: "ZAR",
  TLV: "ILS",
  SAU: "SAR",
};

export function guessCurrencyFromExchange(exchange: string | null): string {
  if (!exchange) return "";
  return EXCHANGE_CURRENCY[exchange.toUpperCase()] ?? "";
}
