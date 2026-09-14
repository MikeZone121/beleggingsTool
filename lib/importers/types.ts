import type { TransactionInput } from "@/lib/validation/transaction";

/**
 * Generic CSV import — the abstraction future broker-specific parsers
 * (DEGIRO, Interactive Brokers, Trading212, ...) will implement. For now
 * there's exactly one implementation: `generic/csvParser.ts`, which expects
 * the user to map their broker's column names onto these fields rather than
 * hardcoding any one broker's export format.
 */
export const GENERIC_CSV_FIELDS = [
  "date",
  "type",
  "ticker",
  "quantity",
  "price",
  "amount",
  "fees",
  "taxes",
  "currency",
  "notes",
  "externalId",
] as const;

export type GenericCsvField = (typeof GENERIC_CSV_FIELDS)[number];

/** User-confirmed mapping: our field name -> the CSV's own header name. */
export type ColumnMapping = Partial<Record<GenericCsvField, string>>;

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export interface SecurityLookup {
  id: string;
  ticker: string;
  currency: string;
}

export interface ImportRowResult {
  rowNumber: number;
  status: "valid" | "error" | "duplicate";
  errors: string[];
  input: (TransactionInput & { securityId: string | null }) | null;
}

export interface ImportSummary {
  totalRows: number;
  imported: number;
  duplicates: number;
  failed: number;
}
