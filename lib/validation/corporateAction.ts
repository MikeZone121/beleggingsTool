import { z } from "zod";
import { positiveDecimalString } from "./decimal";

/**
 * Manual split entry. Only splits are accepted: they are the corporate
 * action the cost-basis ledger knows how to replay (see
 * `lib/finance/costBasis.ts`), so accepting a MERGER here would store a
 * row that silently does nothing.
 *
 * The ratio is the plain multiplier a holding's quantity is multiplied by
 * — 10 for a 10-for-1 split, 0.1 for a 1-for-10 reverse split. The form
 * builds it from the two numbers the user actually reads off an
 * announcement ("10 new for 1 old"), so nobody has to type 0.1.
 */
export const splitInputSchema = z.object({
  securityId: z.string().min(1),
  effectiveDate: z.coerce.date(),
  ratio: positiveDecimalString,
});

export type SplitInput = z.infer<typeof splitInputSchema>;
