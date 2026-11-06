import Decimal from "decimal.js";
import { prisma } from "./client";

/**
 * Corporate actions are stored per security with a JSON `details` payload
 * (see schema.prisma). Only splits are written and read today — they are
 * the ones that change quantity and cost basis, and the cost-basis ledger
 * already replays them (see `SplitEvent` in lib/finance/costBasis.ts).
 * Mergers, spin-offs and ticker changes exist in the enum but have no
 * accounting treatment in the app yet, so nothing creates them.
 *
 * `details.ratio` is stored as the plain multiplier string ("10",
 * "0.1") rather than the "10:1" display form: it is the number the ledger
 * multiplies by, and a single representation means no parser has to guess
 * which side of the colon came first. `toSplitEvent` is the only reader.
 */

export const SPLIT_TYPES = ["SPLIT", "REVERSE_SPLIT"] as const;

export async function listCorporateActionsForSecurities(securityIds: string[]) {
  if (securityIds.length === 0) return [];
  return prisma.corporateAction.findMany({
    where: { securityId: { in: securityIds }, type: { in: [...SPLIT_TYPES] } },
    orderBy: { effectiveDate: "asc" },
  });
}

export async function listAllCorporateActions() {
  return prisma.corporateAction.findMany({
    where: { type: { in: [...SPLIT_TYPES] } },
    orderBy: { effectiveDate: "desc" },
    include: { security: { select: { ticker: true, name: true } } },
  });
}

/**
 * A ratio below 1 *is* a reverse split, so the stored `type` is derived
 * from the number rather than taken from the caller — two fields that can
 * contradict each other is how a 1-for-10 reverse split ends up recorded
 * as a 10-for-1 split.
 */
function typeForRatio(ratio: Decimal) {
  return ratio.lessThan(1) ? "REVERSE_SPLIT" : "SPLIT";
}

/**
 * Idempotent write, keyed on (securityId, effectiveDate): a re-run of the
 * provider sync updates the existing row instead of adding a second copy
 * of the same split, which would double-apply to every holding. Same
 * find-then-write shape as `upsertDividendEvent`, and for the same reason
 * — the model has no unique constraint to upsert against.
 */
export async function upsertSplit(data: {
  securityId: string;
  effectiveDate: Date;
  ratio: Decimal;
  source: string;
}) {
  const existing = await prisma.corporateAction.findFirst({
    where: {
      securityId: data.securityId,
      effectiveDate: data.effectiveDate,
      type: { in: [...SPLIT_TYPES] },
    },
    select: { id: true },
  });

  const payload = {
    type: typeForRatio(data.ratio),
    details: { ratio: data.ratio.toString(), source: data.source },
  } as const;

  if (existing) {
    return prisma.corporateAction.update({ where: { id: existing.id }, data: payload });
  }

  return prisma.corporateAction.create({
    data: {
      securityId: data.securityId,
      effectiveDate: data.effectiveDate,
      ...payload,
    },
  });
}

export async function deleteCorporateAction(id: string) {
  try {
    return await prisma.corporateAction.delete({ where: { id } });
  } catch {
    throw new Error("Corporate action not found");
  }
}
