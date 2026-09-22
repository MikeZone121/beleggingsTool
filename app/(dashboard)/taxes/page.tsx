import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { requireUser } from "@/lib/auth/session";
import { getDefaultPortfolio } from "@/lib/db/portfolios";
import { getCapitalGainsTaxSnapshot } from "@/lib/portfolio/capitalGainsTaxService";
import {
  EXEMPTION_CARRY_STEP,
  EXEMPTION_CARRY_YEARS,
  HISTORIC_COST_OPTION_LAST_YEAR,
  REGIME_FIRST_YEAR,
} from "@/lib/finance/capitalGainsTax";
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  CapitalGainsYearCard,
  type CapitalGainsYearData,
} from "@/components/taxes/capital-gains-year-card";
import { EmptyState } from "@/components/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money, Percent } from "@/components/ui/money";

export default async function TaxesPage() {
  const user = await requireUser();
  const portfolio = await getDefaultPortfolio(user.id);

  if (!portfolio) {
    return <EmptyState title="No portfolio yet" description="No default portfolio was found." />;
  }

  const { tax, baseCurrency, missingReferencePriceTickers, hasMissingFx, baseCurrencyIsEur } =
    await getCapitalGainsTaxSnapshot(user.id, portfolio.id);

  const currentYear = new Date().getUTCFullYear();
  // `years` comes back newest first, and always includes the current year.
  const thisYear = tax.years.find((year) => year.year === currentYear) ?? tax.years[0];
  const years: CapitalGainsYearData[] = tax.years.map((year) => ({
    year: year.year,
    gains: year.gains.toString(),
    losses: year.losses.toString(),
    netGain: year.netGain.toString(),
    exemptionCarriedIn: year.exemptionCarriedIn.toString(),
    exemptionAvailable: year.exemptionAvailable.toString(),
    exemptionUsed: year.exemptionUsed.toString(),
    exemptionRemaining: year.exemptionRemaining.toString(),
    exemptionCarriedOut: year.exemptionCarriedOut.toString(),
    taxableBase: year.taxableBase.toString(),
    taxDue: year.taxDue.toString(),
    unusedLoss: year.unusedLoss.toString(),
    incomplete: year.incomplete,
    sales: year.sales.map((sale) => ({
      transactionId: sale.transactionId,
      ticker: sale.ticker,
      date: sale.date.toISOString(),
      quantity: sale.quantity.toString(),
      proceeds: sale.proceeds.toString(),
      accountingGain: sale.accountingGain.toString(),
      taxableGain: sale.taxableGain.toString(),
      steppedUp: sale.steppedUp,
      usedHistoricCostOption: sale.usedHistoricCostOption,
      missingReferencePrice: sale.missingReferencePrice,
      missingFx: sale.missingFx,
    })),
  }));

  const warnings: string[] = [];
  if (missingReferencePriceTickers.length > 0) {
    warnings.push(
      `No cached 31 December 2025 closing price for ${missingReferencePriceTickers.join(", ")}, so the whole realized gain on those sales is counted as taxable — which overstates the tax. Run "Sync Price History" on Analytics (or Refresh All on the dashboard) to fetch it, or enter the reference value as a correction with your broker's statement.`
    );
  }
  if (hasMissingFx) {
    warnings.push(
      `At least one sale has no historical exchange rate, so it was counted in its own currency instead of ${baseCurrency}. Refresh exchange rates and re-check.`
    );
  }
  if (!baseCurrencyIsEur) {
    warnings.push(
      `This portfolio reports in ${baseCurrency}, but the Belgian tax is assessed in EUR — the exemption and the tax below are indicative only.`
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Taxes</h1>
        <p className="text-sm text-muted-foreground">
          What your realized sales cost in capital gains tax, per calendar year — at{" "}
          <Percent value={tax.rate.toString()} /> above a{" "}
          <Money value={tax.annualExemption.toString()} currency={baseCurrency} /> yearly
          exemption. Change both in{" "}
          <Link href="/settings" className="underline">
            Settings
          </Link>
          .
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label={`Estimated tax ${thisYear.year}`}
          value={<Money value={thisYear.taxDue.toString()} currency={baseCurrency} />}
          sublabel={
            thisYear.taxableBase.isZero()
              ? "Nothing above the exemption yet"
              : (
                  <>
                    On <Money value={thisYear.taxableBase.toString()} currency={baseCurrency} />{" "}
                    above the exemption
                  </>
                )
          }
          tone={thisYear.taxDue.isZero() ? "neutral" : "negative"}
          highlight
        />
        <KpiCard
          label="Tax-free room left"
          value={<Money value={thisYear.exemptionRemaining.toString()} currency={baseCurrency} />}
          sublabel={
            <>
              Of <Money value={thisYear.exemptionAvailable.toString()} currency={baseCurrency} />{" "}
              available in {thisYear.year}
            </>
          }
          tone={thisYear.exemptionRemaining.isZero() ? "neutral" : "positive"}
        />
        <KpiCard
          label={`Net taxable gain ${thisYear.year}`}
          value={
            <Money
              value={thisYear.netGain.toString()}
              currency={baseCurrency}
              signDisplay={thisYear.netGain.isZero() ? "auto" : "always"}
            />
          }
          sublabel={`${thisYear.sales.length} sale${thisYear.sales.length === 1 ? "" : "s"} counted — gains net of losses, measured for tax`}
          tone={
            thisYear.netGain.greaterThan(0)
              ? "positive"
              : thisYear.netGain.lessThan(0)
                ? "negative"
                : "neutral"
          }
        />
      </div>

      {warnings.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
          {warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>{warning}</span>
            </p>
          ))}
        </div>
      )}

      {years.map((year) => (
        <CapitalGainsYearCard
          key={year.year}
          data={year}
          baseCurrency={baseCurrency}
          isCurrentYear={year.year === currentYear}
        />
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How this is worked out</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-xs text-muted-foreground">
          <p>
            Belgium taxes capital gains on financial assets — shares, bonds, funds and trackers,
            crypto, derivatives — realized from 1 January {REGIME_FIRST_YEAR}. The rate is a flat{" "}
            <Percent value={tax.rate.toString()} />, charged only on the part of a calendar
            year&apos;s <em>net</em> gain above the exemption. Unrealized gains are never taxed,
            so nothing here moves until you actually sell.
          </p>
          <p>
            Losses realized in the same year are netted against that year&apos;s gains across
            asset types, but they are not carried to another year — a net-loss year simply taxes
            nothing and the loss then expires.
          </p>
          <p>
            The exemption is{" "}
            <Money value={tax.annualExemption.toString()} currency={baseCurrency} /> per taxpayer
            per year and is indexed annually. If you use less than{" "}
            <Money value={EXEMPTION_CARRY_STEP.toString()} currency={baseCurrency} /> of it, the
            remainder of that first slice carries into the next year for up to{" "}
            {EXEMPTION_CARRY_YEARS} years — so an exemption left untouched builds up to{" "}
            <Money
              value={tax.annualExemption.plus(EXEMPTION_CARRY_STEP.times(EXEMPTION_CARRY_YEARS)).toString()}
              currency={baseCurrency}
            />
            .
          </p>
          <p>
            For anything you already held on 31 December 2025, only the gain built up since then
            counts: the taxable acquisition value is that day&apos;s closing price rather than
            what you paid, which is why a sale&apos;s taxable gain here can be far smaller than
            its realized gain. Where that reference value would tax a gain you never actually
            made, the real purchase price is used instead — allowed until{" "}
            {HISTORIC_COST_OPTION_LAST_YEAR} — but it can only bring the taxable gain down to
            zero, never into a deductible loss.
          </p>
          <p>
            Proceeds are taken net of the fees and taxes booked on each sale, and each sale&apos;s
            cost basis comes from the same average-cost ledger the rest of the app uses.
          </p>
          {tax.preRegimeSales.length > 0 && (
            <p>
              {tax.preRegimeSales.length === 1
                ? "One sale in your history predates the regime and is left out entirely."
                : `${tax.preRegimeSales.length} sales in your history predate the regime and are left out entirely.`}
            </p>
          )}
          <p className="font-medium text-foreground">
            This is an estimate for planning, not a tax return. Your actual assessment is per
            taxpayer rather than per portfolio, covers assets this app never sees, and your broker
            may already have withheld the 10% at source. Check it with your accountant.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
