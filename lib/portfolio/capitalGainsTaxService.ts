import Decimal from "decimal.js";
import { getPortfolioById } from "@/lib/db/portfolios";
import { listTransactionsForPortfolio } from "@/lib/db/transactions";
import { getClosePricesOnOrBefore } from "@/lib/db/prices";
import { listExchangeRates } from "@/lib/db/exchangeRates";
import { toDomainTransaction, toFxRate } from "@/lib/db/mappers";
import { calculateRealizedGains } from "@/lib/finance/realizedPnL";
import type { FiscalStepUp } from "@/lib/finance/costBasis";
import { findFxRate } from "@/lib/finance/currency";
import {
  calculateCapitalGainsTax,
  electTaxableGain,
  HISTORIC_COST_OPTION_LAST_YEAR,
  REFERENCE_DATE,
  REGIME_START_DATE,
  type CapitalGainsTaxResult,
  type TaxableSale,
} from "@/lib/finance/capitalGainsTax";

export interface CapitalGainsTaxSnapshot {
  baseCurrency: string;
  tax: CapitalGainsTaxResult;
  /** Tickers held before 2026 with no cached 31/12/2025 close, so their
   * taxable gain fell back to the full accounting gain — an overstatement,
   * and fixable by syncing price history far enough back. */
  missingReferencePriceTickers: string[];
  /** A sale's base-currency amount couldn't be resolved from a historical
   * FX rate, so it was counted in its own currency instead. */
  hasMissingFx: boolean;
  /** The Belgian regime is assessed in EUR; any other base currency makes
   * the exemption and the tax indicative only. */
  baseCurrencyIsEur: boolean;
}

/**
 * Estimates what a portfolio's realized sales cost in Belgian capital-gains
 * tax, per calendar year (see lib/finance/capitalGainsTax.ts for the rules
 * themselves and for what this estimate deliberately doesn't try to be).
 *
 * The taxable gain is not the realized gain: for anything already held on
 * 31 December 2025 the tax measures against that day's close, not against
 * what was paid. So the average-cost ledger is run twice over the same
 * transactions — once as the rest of the app reports it, once with each
 * security's cost basis re-based to its reference price — and the two are
 * paired per sale, which is also what makes the choice in
 * `electTaxableGain` (claim the real purchase price when the reference
 * value would tax a gain that was never made) possible at all.
 */
export async function getCapitalGainsTaxSnapshot(
  userId: string,
  portfolioId: string
): Promise<CapitalGainsTaxSnapshot> {
  const portfolio = await getPortfolioById(userId, portfolioId);
  if (!portfolio) {
    throw new Error("Portfolio not found");
  }

  const transactionRows = await listTransactionsForPortfolio(userId, portfolioId);
  const transactions = transactionRows.map(toDomainTransaction);
  const baseCurrency = portfolio.baseCurrency;

  const securityById = new Map(
    transactionRows
      .filter((row) => row.security !== null)
      .map((row) => [row.security!.id, row.security!])
  );
  // Which securities were already held when the regime started — the only
  // ones a reference value applies to.
  const heldBefore2026 = new Set(
    transactionRows
      .filter(
        (row) =>
          row.securityId !== null && row.type === "BUY" && row.date < REGIME_START_DATE
      )
      .map((row) => row.securityId!)
  );

  const [fxRateRows, referenceCloses] = await Promise.all([
    listExchangeRates(),
    getClosePricesOnOrBefore(Array.from(heldBefore2026), REFERENCE_DATE),
  ]);
  const fxRates = fxRateRows.map(toFxRate);
  const fxContext = { baseCurrency, fxRates };

  const stepUpBySecurity = new Map<string, FiscalStepUp>();
  const missingReferencePriceTickers: string[] = [];
  for (const securityId of heldBefore2026) {
    const security = securityById.get(securityId);
    if (!security) continue;
    const close = referenceCloses.get(securityId);
    if (!close) {
      missingReferencePriceTickers.push(security.ticker);
      continue;
    }
    const pricePerShare = new Decimal(close);
    const rate =
      security.currency === baseCurrency
        ? new Decimal(1)
        : findFxRate(fxRates, security.currency, baseCurrency, REFERENCE_DATE);
    stepUpBySecurity.set(securityId, {
      effectiveDate: REGIME_START_DATE,
      pricePerShare,
      pricePerShareBase: rate === null ? null : pricePerShare.times(rate),
    });
  }

  const accountingGains = calculateRealizedGains(transactions, new Map(), fxContext);
  const fiscalGains = calculateRealizedGains(
    transactions,
    new Map(),
    fxContext,
    stepUpBySecurity
  );
  const fiscalByTxId = new Map(fiscalGains.map((gain) => [gain.transactionId, gain]));

  let hasMissingFx = false;
  const sales: TaxableSale[] = accountingGains.map((accounting) => {
    const fiscal = fiscalByTxId.get(accounting.transactionId) ?? accounting;
    // Falling back to the security's own currency keeps a sale in the
    // year's totals instead of silently dropping it; `missingFx` is what
    // tells the reader the year mixes currencies.
    const missingFx = accounting.realizedPnLBase === null || fiscal.realizedPnLBase === null;
    if (missingFx) hasMissingFx = true;

    const gainVsActualCost = accounting.realizedPnLBase ?? accounting.realizedPnL;
    const gainVsReference = fiscal.realizedPnLBase ?? fiscal.realizedPnL;
    // The option to claim the real purchase price instead of the reference
    // value runs out after 2030; from then on the reference value is the
    // only acquisition value available.
    const taxableGain =
      accounting.date.getUTCFullYear() <= HISTORIC_COST_OPTION_LAST_YEAR
        ? electTaxableGain(gainVsReference, gainVsActualCost)
        : gainVsReference;
    const security = securityById.get(accounting.securityId);

    return {
      transactionId: accounting.transactionId,
      securityId: accounting.securityId,
      ticker: security?.ticker ?? "—",
      date: accounting.date,
      quantity: accounting.quantity,
      proceeds: accounting.proceedsBase ?? accounting.proceeds,
      accountingGain: gainVsActualCost,
      taxableGain,
      steppedUp: !fiscal.costBasisRemoved.equals(accounting.costBasisRemoved),
      usedHistoricCostOption:
        gainVsReference.isPositive() && taxableGain.lessThan(gainVsReference),
      missingReferencePrice:
        heldBefore2026.has(accounting.securityId) &&
        !stepUpBySecurity.has(accounting.securityId),
      missingFx,
    };
  });

  const tax = calculateCapitalGainsTax(sales, {
    rate: new Decimal(portfolio.capitalGainsTaxRate.toString()),
    annualExemption: new Decimal(portfolio.capitalGainsExemption.toString()),
  });

  return {
    baseCurrency,
    tax,
    missingReferencePriceTickers: Array.from(new Set(missingReferencePriceTickers)).sort(),
    hasMissingFx,
    baseCurrencyIsEur: baseCurrency === "EUR",
  };
}
