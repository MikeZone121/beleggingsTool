import { describe, expect, it } from "vitest";
import { parseCsv, guessColumnMapping, validateImportRow } from "@/lib/importers/generic/csvParser";
import type { SecurityLookup } from "@/lib/importers/types";

const securityByTicker = new Map<string, SecurityLookup>([
  ["ASML", { id: "sec-asml", ticker: "ASML", currency: "EUR" }],
]);

describe("parseCsv", () => {
  it("parses headers and rows", () => {
    const result = parseCsv("Date,Type,Symbol,Shares,Price\n2024-01-01,BUY,ASML,10,600\n");
    expect(result.headers).toEqual(["Date", "Type", "Symbol", "Shares", "Price"]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].Symbol).toBe("ASML");
  });

  it("throws on a file with no detectable columns", () => {
    expect(() => parseCsv("")).toThrow(/any columns/);
  });
});

describe("guessColumnMapping", () => {
  it("maps common header aliases case-insensitively", () => {
    const mapping = guessColumnMapping(["Date", "Symbol", "Shares", "Price", "Fee"]);
    expect(mapping.date).toBe("Date");
    expect(mapping.ticker).toBe("Symbol");
    expect(mapping.quantity).toBe("Shares");
    expect(mapping.price).toBe("Price");
    expect(mapping.fees).toBe("Fee");
  });

  it("leaves a field unmapped when no header matches", () => {
    const mapping = guessColumnMapping(["Date", "Amount"]);
    expect(mapping.ticker).toBeUndefined();
  });
});

const mapping = {
  date: "Date",
  type: "Type",
  ticker: "Symbol",
  quantity: "Shares",
  price: "Price",
  fees: "Fee",
  currency: "Currency",
};

describe("validateImportRow", () => {
  it("validates a well-formed BUY row", () => {
    const result = validateImportRow(
      2,
      { Date: "2024-01-01", Type: "BUY", Symbol: "ASML", Shares: "10", Price: "600", Fee: "5", Currency: "EUR" },
      mapping,
      "acc-1",
      "EUR",
      securityByTicker
    );
    expect(result.status).toBe("valid");
    expect(result.input?.securityId).toBe("sec-asml");
    expect(result.input?.quantity).toBe("10");
  });

  it("errors on an unknown ticker rather than inventing a security", () => {
    const result = validateImportRow(
      2,
      { Date: "2024-01-01", Type: "BUY", Symbol: "UNKNOWN", Shares: "10", Price: "600" },
      mapping,
      "acc-1",
      "EUR",
      securityByTicker
    );
    expect(result.status).toBe("error");
    expect(result.errors[0]).toMatch(/Unknown ticker/);
  });

  it("errors on a missing date", () => {
    const result = validateImportRow(
      2,
      { Type: "BUY", Symbol: "ASML", Shares: "10", Price: "600" },
      mapping,
      "acc-1",
      "EUR",
      securityByTicker
    );
    expect(result.status).toBe("error");
    expect(result.errors).toContain("Missing date");
  });

  it("errors on an unparseable date rather than guessing", () => {
    const result = validateImportRow(
      2,
      { Date: "not-a-date", Type: "BUY", Symbol: "ASML", Shares: "10", Price: "600" },
      mapping,
      "acc-1",
      "EUR",
      securityByTicker
    );
    expect(result.status).toBe("error");
    expect(result.errors[0]).toMatch(/Unrecognized date/);
  });

  it("falls back to the security's own currency when no currency column is mapped", () => {
    const result = validateImportRow(
      2,
      { Date: "2024-01-01", Type: "BUY", Symbol: "ASML", Shares: "10", Price: "600" },
      { date: "Date", type: "Type", ticker: "Symbol", quantity: "Shares", price: "Price" },
      "acc-1",
      "USD",
      securityByTicker
    );
    expect(result.status).toBe("valid");
    expect(result.input?.currency).toBe("EUR");
  });

  it("validates a DEPOSIT row with no ticker required", () => {
    const result = validateImportRow(
      2,
      { Date: "2024-01-01", Type: "DEPOSIT" },
      { ...mapping, amount: "Amount" } as never,
      "acc-1",
      "EUR",
      securityByTicker
    );
    // no Amount column value present -> should fail validation (amount required)
    expect(result.status).toBe("error");
  });

  it("validates a DIVIDEND row using the amount field, not quantity/price", () => {
    const result = validateImportRow(
      2,
      { Date: "2024-01-01", Type: "DIVIDEND", Symbol: "ASML", Amount: "50" },
      { ...mapping, amount: "Amount" },
      "acc-1",
      "EUR",
      securityByTicker
    );
    expect(result.status).toBe("valid");
    expect(result.input?.amount).toBe("50");
  });
});
