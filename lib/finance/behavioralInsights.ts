import Decimal from "decimal.js";
import type { Holding, CurrencyCode } from "@/types/domain";

export interface BehavioralInsight {
  id: string;
  tone: "info" | "caution";
  message: string;
}

export interface BehavioralInsightsInput {
  holdings: Holding[];
  totalValueBase: Decimal;
  cashBalanceBase: Decimal;
  baseCurrency: CurrencyCode;
  realizedGainsCount: number;
  realizedLossesCount: number;
}

const SINGLE_HOLDING_CONCENTRATION_THRESHOLD = 0.25;
const CURRENCY_CONCENTRATION_THRESHOLD = 0.4;
const CASH_DRAG_THRESHOLD = 0.5;
/** Below this many realized sales, "you've never taken a loss" isn't a
 * pattern — it's just not enough trades to say anything about yet. */
const MIN_SALES_FOR_LOSS_PATTERN = 3;

/**
 * Simple, honest, rule-based observations from data this app already
 * trusts — no AI, no cost, always on. Deliberately narrow: every rule
 * here is a plain threshold on numbers already computed elsewhere
 * (concentration, currency exposure, cash weight, realized win/loss
 * count), not a guess about intent. Complements — doesn't replace —
 * the AI-generated news summaries on this same page.
 */
export function calculateBehavioralInsights(input: BehavioralInsightsInput): BehavioralInsight[] {
  const {
    holdings,
    totalValueBase,
    cashBalanceBase,
    baseCurrency,
    realizedGainsCount,
    realizedLossesCount,
  } = input;
  const insights: BehavioralInsight[] = [];

  if (totalValueBase.greaterThan(0)) {
    for (const holding of holdings) {
      if (!holding.marketValueBase) continue;
      const weight = holding.marketValueBase.dividedBy(totalValueBase);
      if (weight.greaterThan(SINGLE_HOLDING_CONCENTRATION_THRESHOLD)) {
        insights.push({
          id: `concentration-${holding.securityId}`,
          tone: "caution",
          message: `${holding.ticker} is ${weight.times(100).toFixed(0)}% of your total portfolio — a single-company position this size moves your whole net worth with it.`,
        });
      }
    }

    const valueByCurrency = new Map<CurrencyCode, Decimal>();
    for (const holding of holdings) {
      if (!holding.marketValueBase) continue;
      valueByCurrency.set(
        holding.currency,
        (valueByCurrency.get(holding.currency) ?? new Decimal(0)).plus(holding.marketValueBase)
      );
    }
    for (const [currency, value] of valueByCurrency) {
      if (currency === baseCurrency) continue;
      const weight = value.dividedBy(totalValueBase);
      if (weight.greaterThan(CURRENCY_CONCENTRATION_THRESHOLD)) {
        insights.push({
          id: `currency-${currency}`,
          tone: "info",
          message: `${weight.times(100).toFixed(0)}% of your portfolio is priced in ${currency}, not your base currency (${baseCurrency}) — currency moves affect your returns independently of how the holding itself performs.`,
        });
      }
    }

    const cashWeight = cashBalanceBase.dividedBy(totalValueBase);
    if (cashWeight.greaterThan(CASH_DRAG_THRESHOLD)) {
      insights.push({
        id: "cash-drag",
        tone: "info",
        message: `${cashWeight.times(100).toFixed(0)}% of your portfolio is sitting in cash, earning no market return — worth checking whether that's deliberate (saving for something specific) or just uninvested.`,
      });
    }
  }

  const totalSales = realizedGainsCount + realizedLossesCount;
  if (totalSales >= MIN_SALES_FOR_LOSS_PATTERN && realizedLossesCount === 0) {
    insights.push({
      id: "no-realized-losses",
      tone: "info",
      message: `You've realized ${realizedGainsCount} gain${realizedGainsCount === 1 ? "" : "s"} and no losses so far — not necessarily a problem, but if you're avoiding selling losers to avoid "admitting" a loss, that's a common bias worth being aware of.`,
    });
  }

  return insights;
}
