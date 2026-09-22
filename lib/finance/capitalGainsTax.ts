import Decimal from "decimal.js";
import { ZERO } from "./money";

/**
 * Belgian capital-gains tax on financial assets ("meerwaardebelasting" /
 * solidariteitsbijdrage), in force for gains realized from 1 January 2026.
 *
 * The rules this models, and where each one shows up below:
 *  - A flat 10% on capital gains realized by a private investor on shares,
 *    bonds, funds/trackers, crypto and derivatives. Rate is a setting
 *    (`Portfolio.capitalGainsTaxRate`) rather than a constant, because it
 *    is the kind of number a government changes.
 *  - An annual exemption of EUR 10 000 per taxpayer (indexed yearly, hence
 *    also a setting): tax is due only on the part of a year's *net* gain
 *    above it. A couple has one each, which is why the setting can simply
 *    be raised to 20 000 rather than the app trying to model a household.
 *  - Unused exemption is carried forward, but only the first EUR 1 000
 *    slice of it and for at most 5 years, so the exemption can build up to
 *    EUR 15 000 for someone who realizes nothing in the meantime
 *    (`EXEMPTION_CARRY_STEP`, `EXEMPTION_CARRY_YEARS`).
 *  - Losses ("minderwaarden") realized in the same calendar year net
 *    against that year's gains, across asset categories, but are *not*
 *    carried to another year: a net-loss year taxes nothing and the loss
 *    then expires (`unusedLoss`).
 *  - Gains built up before the regime started are out of scope: for a
 *    position already held on 31 December 2025 the taxable acquisition
 *    value is that day's closing price, not what was actually paid (the
 *    "step-up", see `FiscalStepUp` in costBasis.ts). Until 31 December
 *    2030 the actual, higher purchase price may be claimed instead —
 *    `electTaxableGain` below implements that choice.
 *
 * Everything here is an estimate for planning, not a tax return: the real
 * filing works per taxpayer (not per portfolio), covers assets this app
 * never sees, and the administration's own mechanics for the carry-forward
 * and for the declaration are still settling. The UI says so out loud.
 *
 * Monetary inputs are expected in one currency (the portfolio base
 * currency) — the tax is assessed in EUR, so a non-EUR base currency makes
 * these numbers indicative only, and callers flag that rather than
 * silently converting at today's rate.
 */

/** First calendar year whose realized gains fall under the regime. */
export const REGIME_FIRST_YEAR = 2026;

/** The reference date whose closing price becomes the taxable acquisition
 * value of anything already held when the regime started. */
export const REFERENCE_DATE = new Date(Date.UTC(2025, 11, 31));

/** Step-up date used in the cost-basis ledger: the reference *price* is
 * 31/12/2025's close, so it must be applied after that day's own trades —
 * i.e. as the opening position of the first day under the regime. */
export const REGIME_START_DATE = new Date(Date.UTC(2026, 0, 1));

/** Last year in which the actual (higher) historical purchase price may be
 * claimed instead of the 31/12/2025 reference value. */
export const HISTORIC_COST_OPTION_LAST_YEAR = 2030;

export const DEFAULT_TAX_RATE = new Decimal("0.10");
export const DEFAULT_ANNUAL_EXEMPTION = new Decimal(10_000);

/** Only this much of an unused annual exemption can be carried forward... */
export const EXEMPTION_CARRY_STEP = new Decimal(1_000);
/** ...for at most this many following years, so the exemption tops out at
 * `annualExemption + EXEMPTION_CARRY_STEP * EXEMPTION_CARRY_YEARS`
 * (10 000 + 5 x 1 000 = 15 000 at the default). */
export const EXEMPTION_CARRY_YEARS = 5;

/** One SELL, reduced to what the tax regime cares about. Amounts are in the
 * portfolio base currency. */
export interface TaxableSale {
  transactionId: string;
  securityId: string;
  ticker: string;
  date: Date;
  quantity: Decimal;
  /** Sale proceeds, net of the fees/taxes booked on the sale itself. */
  proceeds: Decimal;
  /** What the sale actually made, measured against what was paid — the same
   * number the Transactions page shows. Reported alongside the taxable
   * gain so the difference between the two is visible instead of looking
   * like a bug. */
  accountingGain: Decimal;
  /** The gain the tax is computed on (see `electTaxableGain`). Negative for
   * a deductible loss. */
  taxableGain: Decimal;
  /** True when part of the position sold was held before 2026, so the
   * taxable gain was measured against the 31/12/2025 reference value. */
  steppedUp: boolean;
  /** True when the reference value would have taxed a gain the investor
   * never made, and the actual purchase price was claimed instead. */
  usedHistoricCostOption: boolean;
  /** True when no reference price could be resolved for a pre-2026
   * position, so `taxableGain` fell back to the accounting gain and is
   * likely overstated. */
  missingReferencePrice: boolean;
  /** True when a base-currency amount couldn't be resolved for this sale. */
  missingFx: boolean;
}

export interface CapitalGainsTaxYear {
  year: number;
  /** Sum of the year's taxable gains (losses excluded). */
  gains: Decimal;
  /** Sum of the year's deductible losses, as a positive magnitude. */
  losses: Decimal;
  /** `gains - losses`; negative in a net-loss year. */
  netGain: Decimal;
  /** Carried in from earlier years, on top of the annual exemption. */
  exemptionCarriedIn: Decimal;
  exemptionAvailable: Decimal;
  exemptionUsed: Decimal;
  /** Available but unused — what shelters a further gain this same year. */
  exemptionRemaining: Decimal;
  exemptionCarriedOut: Decimal;
  taxableBase: Decimal;
  taxDue: Decimal;
  /** Net loss that expires at year end because losses aren't carried. */
  unusedLoss: Decimal;
  sales: TaxableSale[];
  /** Any figure in this year rests on an unresolved FX rate or a missing
   * 31/12/2025 reference price. */
  incomplete: boolean;
}

export interface CapitalGainsTaxResult {
  rate: Decimal;
  annualExemption: Decimal;
  years: CapitalGainsTaxYear[];
  /** Sales realized before the regime started — untaxed, and listed only
   * so the UI can say why they're absent from every total. */
  preRegimeSales: TaxableSale[];
  totalTaxDue: Decimal;
}

/**
 * Which acquisition value a sale's taxable gain is measured against.
 *
 * `gainVsReference` uses the 31/12/2025 close (the regime's default for a
 * position held before 2026); `gainVsActualCost` uses what was really
 * paid. The investor may claim the second until 2030, and would only do so
 * when it helps — hence the min. The floor at zero is the case that makes
 * this more than a `min`: a share bought at 100, worth 50 at the end of
 * 2025 and sold at 70 shows a gain of 20 against the reference value and a
 * loss of 30 against the purchase price. That loss accrued before the
 * regime, so it is not deductible — claiming the purchase price can bring
 * the taxable gain down to zero, never below it.
 */
export function electTaxableGain(
  gainVsReference: Decimal,
  gainVsActualCost: Decimal
): Decimal {
  if (!gainVsReference.isPositive()) return gainVsReference;
  return Decimal.max(ZERO, Decimal.min(gainVsReference, gainVsActualCost));
}

interface CarrySlice {
  /** Year the slice accrued in; it expires after `EXEMPTION_CARRY_YEARS`. */
  year: number;
  amount: Decimal;
}

/** Oldest-first, so the slice closest to expiring is always consumed first. */
function liveSlices(slices: CarrySlice[], year: number): CarrySlice[] {
  return slices.filter((slice) => year - slice.year <= EXEMPTION_CARRY_YEARS);
}

function sumSlices(slices: CarrySlice[]): Decimal {
  return slices.reduce((acc, slice) => acc.plus(slice.amount), ZERO);
}

function consumeSlices(slices: CarrySlice[], amount: Decimal): CarrySlice[] {
  let left = amount;
  const remaining: CarrySlice[] = [];
  for (const slice of slices) {
    if (left.isZero()) {
      remaining.push(slice);
      continue;
    }
    const taken = Decimal.min(slice.amount, left);
    left = left.minus(taken);
    const rest = slice.amount.minus(taken);
    if (rest.isPositive()) remaining.push({ year: slice.year, amount: rest });
  }
  return remaining;
}

export interface CapitalGainsTaxOptions {
  /** Fraction, e.g. 0.10 for 10%. */
  rate?: Decimal;
  annualExemption?: Decimal;
  /** Last year to report, even with no sales in it — the current year, so
   * "what would I owe if I sold nothing more" is answerable, and so an
   * exemption that has been building up is visible. */
  throughYear?: number;
}

/**
 * Per-calendar-year tax position from a flat list of sales.
 *
 * Years with no sales are still walked rather than skipped: that is how an
 * unused exemption accrues its carry-forward, so leaving them out would
 * understate the exemption available in a later year.
 */
export function calculateCapitalGainsTax(
  sales: TaxableSale[],
  options: CapitalGainsTaxOptions = {}
): CapitalGainsTaxResult {
  const rate = options.rate ?? DEFAULT_TAX_RATE;
  const annualExemption = options.annualExemption ?? DEFAULT_ANNUAL_EXEMPTION;
  const throughYear = options.throughYear ?? new Date().getUTCFullYear();

  const preRegimeSales: TaxableSale[] = [];
  const salesByYear = new Map<number, TaxableSale[]>();
  for (const sale of sales) {
    const year = sale.date.getUTCFullYear();
    if (year < REGIME_FIRST_YEAR) {
      preRegimeSales.push(sale);
      continue;
    }
    const list = salesByYear.get(year) ?? [];
    list.push(sale);
    salesByYear.set(year, list);
  }

  const lastYear = Math.max(throughYear, ...salesByYear.keys(), REGIME_FIRST_YEAR);
  const years: CapitalGainsTaxYear[] = [];
  let slices: CarrySlice[] = [];
  let totalTaxDue = ZERO;

  for (let year = REGIME_FIRST_YEAR; year <= lastYear; year += 1) {
    slices = liveSlices(slices, year);
    const carriedIn = sumSlices(slices);
    const exemptionAvailable = annualExemption.plus(carriedIn);

    const yearSales = (salesByYear.get(year) ?? []).sort(
      (a, b) => a.date.getTime() - b.date.getTime()
    );
    let gains = ZERO;
    let losses = ZERO;
    let incomplete = false;
    for (const sale of yearSales) {
      if (sale.taxableGain.isPositive()) {
        gains = gains.plus(sale.taxableGain);
      } else {
        losses = losses.plus(sale.taxableGain.abs());
      }
      if (sale.missingFx || sale.missingReferencePrice) incomplete = true;
    }

    const netGain = gains.minus(losses);
    const exemptionUsed = netGain.isPositive()
      ? Decimal.min(exemptionAvailable, netGain)
      : ZERO;
    const taxableBase = Decimal.max(ZERO, netGain.minus(exemptionUsed));
    const taxDue = taxableBase.times(rate);

    // The annual exemption is spent before anything carried in, so only
    // what exceeds it eats into the carried slices.
    slices = consumeSlices(slices, Decimal.max(ZERO, exemptionUsed.minus(annualExemption)));
    const accrued = Decimal.max(ZERO, EXEMPTION_CARRY_STEP.minus(exemptionUsed));
    if (accrued.isPositive()) slices.push({ year, amount: accrued });

    years.push({
      year,
      gains,
      losses,
      netGain,
      exemptionCarriedIn: carriedIn,
      exemptionAvailable,
      exemptionUsed,
      exemptionRemaining: exemptionAvailable.minus(exemptionUsed),
      exemptionCarriedOut: sumSlices(liveSlices(slices, year + 1)),
      taxableBase,
      taxDue,
      unusedLoss: netGain.isNegative() ? netGain.abs() : ZERO,
      sales: yearSales,
      incomplete,
    });
    totalTaxDue = totalTaxDue.plus(taxDue);
  }

  return {
    rate,
    annualExemption,
    years: years.reverse(),
    preRegimeSales,
    totalTaxDue,
  };
}
