import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateCapitalGainsTax,
  electTaxableGain,
  type TaxableSale,
} from "@/lib/finance/capitalGainsTax";
import { d } from "./helpers";

let counter = 0;

/** A sale reduced to the two fields every test here cares about: when it
 * happened and what gain it produced. */
function sale(date: string, taxableGain: number, extra: Partial<TaxableSale> = {}): TaxableSale {
  counter += 1;
  const gain = new Decimal(taxableGain);
  return {
    transactionId: `tx-${counter}`,
    securityId: "sec-1",
    ticker: "AAPL",
    date: new Date(date),
    quantity: d(1),
    proceeds: gain,
    accountingGain: gain,
    taxableGain: gain,
    steppedUp: false,
    usedHistoricCostOption: false,
    missingReferencePrice: false,
    missingFx: false,
    ...extra,
  };
}

describe("calculateCapitalGainsTax", () => {
  it("taxes nothing while the year's net gain stays inside the exemption", () => {
    const result = calculateCapitalGainsTax([sale("2026-03-01", 9_500)], { throughYear: 2026 });
    const year = result.years[0];

    expect(year.year).toBe(2026);
    expect(year.netGain.toString()).toBe("9500");
    expect(year.exemptionUsed.toString()).toBe("9500");
    expect(year.exemptionRemaining.toString()).toBe("500");
    expect(year.taxableBase.toString()).toBe("0");
    expect(year.taxDue.toString()).toBe("0");
    expect(result.totalTaxDue.toString()).toBe("0");
  });

  it("taxes only the part above the exemption, at 10%", () => {
    const result = calculateCapitalGainsTax([sale("2026-06-01", 25_000)], { throughYear: 2026 });
    const year = result.years[0];

    expect(year.exemptionUsed.toString()).toBe("10000");
    expect(year.taxableBase.toString()).toBe("15000");
    expect(year.taxDue.toString()).toBe("1500");
  });

  it("nets losses against gains within the same year", () => {
    const result = calculateCapitalGainsTax(
      [sale("2026-02-01", 14_000), sale("2026-09-01", -2_000)],
      { throughYear: 2026 }
    );
    const year = result.years[0];

    expect(year.gains.toString()).toBe("14000");
    expect(year.losses.toString()).toBe("2000");
    expect(year.netGain.toString()).toBe("12000");
    expect(year.taxableBase.toString()).toBe("2000");
    expect(year.taxDue.toString()).toBe("200");
  });

  it("lets a net loss expire instead of carrying it into the next year", () => {
    const result = calculateCapitalGainsTax(
      [sale("2026-02-01", -5_000), sale("2027-02-01", 12_000)],
      { throughYear: 2027 }
    );
    const [y2027, y2026] = result.years;

    expect(y2026.year).toBe(2026);
    expect(y2026.netGain.toString()).toBe("-5000");
    expect(y2026.taxDue.toString()).toBe("0");
    expect(y2026.unusedLoss.toString()).toBe("5000");

    // 2027 sees only its own gain — the 5 000 loss is gone, not deducted —
    // and 2026's untouched exemption carried 1 000 forward.
    expect(y2027.exemptionCarriedIn.toString()).toBe("1000");
    expect(y2027.exemptionAvailable.toString()).toBe("11000");
    expect(y2027.taxableBase.toString()).toBe("1000");
    expect(y2027.taxDue.toString()).toBe("100");
  });

  it("carries 1 000 forward per quiet year, up to a 15 000 exemption", () => {
    const result = calculateCapitalGainsTax([], { throughYear: 2033 });
    const byYear = new Map(result.years.map((y) => [y.year, y]));

    expect(byYear.get(2026)!.exemptionAvailable.toString()).toBe("10000");
    expect(byYear.get(2027)!.exemptionAvailable.toString()).toBe("11000");
    expect(byYear.get(2031)!.exemptionAvailable.toString()).toBe("15000");
    // The ceiling holds: a sixth quiet year replaces the slice that expires,
    // it doesn't stack on top of it.
    expect(byYear.get(2033)!.exemptionAvailable.toString()).toBe("15000");
  });

  it("carries forward only the unused part of the first 1 000", () => {
    const result = calculateCapitalGainsTax([sale("2026-04-01", 600)], { throughYear: 2027 });
    const byYear = new Map(result.years.map((y) => [y.year, y]));

    expect(byYear.get(2026)!.exemptionCarriedOut.toString()).toBe("400");
    expect(byYear.get(2027)!.exemptionAvailable.toString()).toBe("10400");
  });

  it("carries nothing forward once more than 1 000 of exemption is used", () => {
    const result = calculateCapitalGainsTax([sale("2026-04-01", 4_000)], { throughYear: 2027 });
    const byYear = new Map(result.years.map((y) => [y.year, y]));

    expect(byYear.get(2026)!.exemptionCarriedOut.toString()).toBe("0");
    expect(byYear.get(2027)!.exemptionAvailable.toString()).toBe("10000");
  });

  it("spends the annual exemption before an accumulated carry-forward", () => {
    // Quiet 2026 builds 1 000; 2027 realizes 10 500, so 500 of the carry is
    // consumed and nothing new accrues.
    const result = calculateCapitalGainsTax([sale("2027-04-01", 10_500)], { throughYear: 2028 });
    const byYear = new Map(result.years.map((y) => [y.year, y]));

    expect(byYear.get(2027)!.exemptionAvailable.toString()).toBe("11000");
    expect(byYear.get(2027)!.exemptionUsed.toString()).toBe("10500");
    expect(byYear.get(2027)!.taxDue.toString()).toBe("0");
    expect(byYear.get(2028)!.exemptionAvailable.toString()).toBe("10500");
  });

  it("leaves sales realized before 2026 out of every year", () => {
    const result = calculateCapitalGainsTax(
      [sale("2025-12-30", 40_000), sale("2026-01-05", 1_000)],
      { throughYear: 2026 }
    );

    expect(result.preRegimeSales).toHaveLength(1);
    expect(result.years).toHaveLength(1);
    expect(result.years[0].gains.toString()).toBe("1000");
    expect(result.totalTaxDue.toString()).toBe("0");
  });

  it("flags a year whose figures rest on missing FX or reference prices", () => {
    const result = calculateCapitalGainsTax(
      [sale("2026-05-01", 500, { missingFx: true })],
      { throughYear: 2026 }
    );
    expect(result.years[0].incomplete).toBe(true);
  });

  it("honours a configured rate and exemption", () => {
    const result = calculateCapitalGainsTax([sale("2026-05-01", 30_000)], {
      rate: new Decimal("0.15"),
      annualExemption: new Decimal(20_000),
      throughYear: 2026,
    });
    expect(result.years[0].taxableBase.toString()).toBe("10000");
    expect(result.years[0].taxDue.toString()).toBe("1500");
  });

  it("reports the current year even when nothing was sold in it", () => {
    const result = calculateCapitalGainsTax([sale("2026-05-01", 100)], { throughYear: 2028 });
    expect(result.years.map((y) => y.year)).toEqual([2028, 2027, 2026]);
  });
});

describe("electTaxableGain", () => {
  it("keeps the reference-value gain when the purchase price doesn't help", () => {
    expect(electTaxableGain(d(500), d(900)).toString()).toBe("500");
  });

  it("claims the actual purchase price when it lowers the gain", () => {
    expect(electTaxableGain(d(500), d(120)).toString()).toBe("120");
  });

  it("never turns a pre-2026 loss into a deductible one", () => {
    // Bought at 100, worth 50 at the end of 2025, sold at 70.
    expect(electTaxableGain(d(20), d(-30)).toString()).toBe("0");
  });

  it("keeps a loss that accrued under the regime deductible", () => {
    expect(electTaxableGain(d(-40), d(-90)).toString()).toBe("-40");
  });
});
