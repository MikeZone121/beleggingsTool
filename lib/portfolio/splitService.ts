import { listCorporateActionsForSecurities } from "@/lib/db/corporateActions";
import { toSplitEvent } from "@/lib/db/mappers";
import type { SplitEvent } from "@/types/domain";

/**
 * Loads the split events for a set of securities, grouped the way every
 * cost-basis consumer wants them (`deriveHoldings`, `calculateRealizedGains`
 * and `computeAverageCostLedger` all take a `Map<securityId, SplitEvent[]>`).
 *
 * This is the single place splits enter the read path. Before it existed,
 * every caller passed `new Map()` — the `CorporateAction` table was
 * written by nothing and read by nothing, so a split silently left the
 * portfolio showing pre-split quantities and a cost basis per share that
 * was wrong by the split factor.
 *
 * A row with an unusable ratio is skipped rather than guessed at (see
 * `toSplitEvent`); `skipped` is returned so a caller that has somewhere to
 * show it can, instead of the number quietly disappearing.
 */
export async function loadSplitsBySecurity(
  securityIds: string[]
): Promise<{ splitsBySecurity: Map<string, SplitEvent[]>; skipped: number }> {
  const rows = await listCorporateActionsForSecurities(securityIds);

  const splitsBySecurity = new Map<string, SplitEvent[]>();
  let skipped = 0;

  for (const row of rows) {
    const event = toSplitEvent(row);
    if (!event) {
      skipped += 1;
      continue;
    }
    const existing = splitsBySecurity.get(event.securityId);
    if (existing) {
      existing.push(event);
    } else {
      splitsBySecurity.set(event.securityId, [event]);
    }
  }

  return { splitsBySecurity, skipped };
}
