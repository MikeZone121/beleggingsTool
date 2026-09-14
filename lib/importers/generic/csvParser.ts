import Papa from "papaparse";
import type { ParsedCsv, ColumnMapping, GenericCsvField, ImportRowResult, SecurityLookup } from "@/lib/importers/types";
import { GENERIC_CSV_FIELDS } from "@/lib/importers/types";
import { transactionInputSchema } from "@/lib/validation/transaction";

/** Parses raw CSV text into headers + row objects. Throws only on
 * structurally broken input (no delimiter detected); malformed individual
 * rows are reported per-row by `validateImportRow`, never silently skipped. */
export function parseCsv(text: string): ParsedCsv {
  const result = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const headers = result.meta.fields ?? [];
  if (headers.length === 0) {
    throw new Error("Could not detect any columns in this CSV file");
  }

  return { headers, rows: result.data };
}

/** Best-effort auto-mapping: matches CSV headers to our fields by common
 * aliases (case/whitespace-insensitive). The user confirms/adjusts this
 * before import — never applied silently. */
export function guessColumnMapping(headers: string[]): ColumnMapping {
  const aliases: Record<GenericCsvField, string[]> = {
    date: ["date", "transaction date", "trade date"],
    type: ["type", "transaction type", "action"],
    ticker: ["ticker", "symbol", "isin", "instrument"],
    quantity: ["quantity", "shares", "units"],
    price: ["price", "price per share", "unit price"],
    amount: ["amount", "value", "total"],
    fees: ["fees", "fee", "commission"],
    taxes: ["taxes", "tax", "withholding tax"],
    currency: ["currency", "ccy"],
    notes: ["notes", "description", "memo"],
    externalId: ["externalid", "order id", "reference", "transaction id"],
  };

  const normalizedHeaders = headers.map((h) => ({ raw: h, norm: h.trim().toLowerCase() }));
  const mapping: ColumnMapping = {};

  for (const field of GENERIC_CSV_FIELDS) {
    const match = normalizedHeaders.find((h) => aliases[field].includes(h.norm));
    if (match) mapping[field] = match.raw;
  }

  return mapping;
}

function cell(row: Record<string, string>, mapping: ColumnMapping, field: GenericCsvField): string {
  const header = mapping[field];
  if (!header) return "";
  return (row[header] ?? "").trim();
}

const TYPES_REQUIRING_SECURITY = new Set(["BUY", "SELL", "DIVIDEND", "SPLIT"]);
const TYPES_REQUIRING_QUANTITY_PRICE = new Set(["BUY", "SELL"]);

/**
 * Validates one CSV row into a `TransactionInput`, resolving its ticker
 * against already-known securities. Never silently invents a security,
 * a currency, or a missing amount — every gap becomes an error the user
 * sees before anything is imported.
 */
export function validateImportRow(
  rowNumber: number,
  row: Record<string, string>,
  mapping: ColumnMapping,
  accountId: string,
  defaultCurrency: string,
  securityByTicker: Map<string, SecurityLookup>
): ImportRowResult {
  const errors: string[] = [];

  const type = cell(row, mapping, "type").toUpperCase();
  const dateRaw = cell(row, mapping, "date");
  const tickerRaw = cell(row, mapping, "ticker");
  const quantityRaw = cell(row, mapping, "quantity");
  const priceRaw = cell(row, mapping, "price");
  const amountRaw = cell(row, mapping, "amount");
  const feesRaw = cell(row, mapping, "fees");
  const taxesRaw = cell(row, mapping, "taxes");
  const currencyRaw = cell(row, mapping, "currency");
  const notes = cell(row, mapping, "notes");
  const externalId = cell(row, mapping, "externalId");

  if (!dateRaw) errors.push("Missing date");
  const date = dateRaw ? new Date(dateRaw) : null;
  if (dateRaw && (!date || Number.isNaN(date.getTime()))) {
    errors.push(`Unrecognized date: "${dateRaw}"`);
  }

  let security: SecurityLookup | undefined;
  if (TYPES_REQUIRING_SECURITY.has(type)) {
    if (!tickerRaw) {
      errors.push(`${type || "This row"} requires a ticker`);
    } else {
      security = securityByTicker.get(tickerRaw.toUpperCase());
      if (!security) {
        errors.push(`Unknown ticker "${tickerRaw}" — add it as a security first`);
      }
    }
  }

  const currency = currencyRaw || security?.currency || defaultCurrency;

  if (errors.length > 0) {
    return { rowNumber, status: "error", errors, input: null };
  }

  const parsed = transactionInputSchema.safeParse({
    accountId,
    securityId: security?.id ?? null,
    type,
    date: dateRaw,
    quantity: TYPES_REQUIRING_QUANTITY_PRICE.has(type) ? quantityRaw : null,
    price: TYPES_REQUIRING_QUANTITY_PRICE.has(type) ? priceRaw : null,
    amount: TYPES_REQUIRING_QUANTITY_PRICE.has(type) ? null : amountRaw || null,
    fees: feesRaw || "0",
    taxes: taxesRaw || "0",
    currency,
    notes: notes || undefined,
    externalId: externalId || undefined,
  });

  if (!parsed.success) {
    return {
      rowNumber,
      status: "error",
      errors: parsed.error.issues.map((i) => `${i.path.join(".") || "row"}: ${i.message}`),
      input: null,
    };
  }

  return { rowNumber, status: "valid", errors: [], input: parsed.data };
}
