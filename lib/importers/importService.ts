import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/client";
import { createImportBatch } from "@/lib/db/importBatches";
import { computeTransactionAmounts } from "@/lib/finance/transactionAmounts";
import type { ImportRowResult, ImportSummary } from "@/lib/importers/types";
import Decimal from "decimal.js";

function toDecimalOrNull(value: string | null): Decimal | null {
  return value === null ? null : new Decimal(value);
}

/**
 * Commits already-validated rows (see `validateImportRow` — this function
 * trusts `status: "valid"` rows completely and re-derives nothing about
 * their correctness, only their gross/net amounts). Each row is inserted
 * individually so one duplicate (same `accountId` + `externalId`) is
 * skipped and reported rather than failing the whole batch.
 */
export async function commitImport(
  accountId: string,
  fileName: string,
  rows: ImportRowResult[]
): Promise<ImportSummary> {
  let imported = 0;
  let duplicates = 0;
  let insertFailed = 0;
  const validationErrors = rows
    .filter((r) => r.status === "error")
    .map((r) => ({ rowNumber: r.rowNumber, message: r.errors.join("; ") }));
  const insertErrors: Array<{ rowNumber: number; message: string }> = [];

  for (const row of rows) {
    if (row.status !== "valid" || !row.input) {
      continue;
    }

    const { input } = row;
    const { grossAmount, netAmount } = computeTransactionAmounts({
      type: input.type,
      quantity: toDecimalOrNull(input.quantity),
      price: toDecimalOrNull(input.price),
      amount: toDecimalOrNull(input.amount),
      fees: new Decimal(input.fees),
      taxes: new Decimal(input.taxes),
    });

    try {
      await prisma.transaction.create({
        data: {
          accountId,
          securityId: input.securityId,
          type: input.type,
          date: input.date,
          quantity: input.quantity,
          price: input.price,
          grossAmount: grossAmount.toString(),
          fees: input.fees,
          taxes: input.taxes,
          netAmount: netAmount.toString(),
          currency: input.currency,
          exchangeRate: input.exchangeRate,
          notes: input.notes ?? null,
          externalId: input.externalId ?? null,
        },
      });
      imported += 1;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        duplicates += 1;
      } else {
        insertFailed += 1;
        insertErrors.push({
          rowNumber: row.rowNumber,
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  const summary: ImportSummary = {
    totalRows: rows.length,
    imported,
    duplicates,
    failed: validationErrors.length + insertFailed,
  };

  await createImportBatch({
    accountId,
    source: "generic-csv",
    fileName,
    status: "COMPLETED",
    summary: { ...summary, errors: [...validationErrors, ...insertErrors] },
  });

  return summary;
}
