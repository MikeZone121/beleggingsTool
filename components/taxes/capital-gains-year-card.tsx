import type { ReactNode } from "react";
import { TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Money, Quantity } from "@/components/ui/money";
import { formatDate, pnlToneClass } from "@/lib/utils/format";
import { getUserLocale } from "@/lib/utils/serverLocale";

export interface CapitalGainsSaleData {
  transactionId: string;
  ticker: string;
  /** ISO date string. */
  date: string;
  quantity: string;
  proceeds: string;
  /** What the sale made against what was actually paid. */
  accountingGain: string;
  /** What the tax is computed on — different from `accountingGain`
   * whenever part of the position predates the regime. */
  taxableGain: string;
  steppedUp: boolean;
  usedHistoricCostOption: boolean;
  missingReferencePrice: boolean;
  missingFx: boolean;
}

export interface CapitalGainsYearData {
  year: number;
  gains: string;
  losses: string;
  netGain: string;
  exemptionCarriedIn: string;
  exemptionAvailable: string;
  exemptionUsed: string;
  exemptionRemaining: string;
  exemptionCarriedOut: string;
  taxableBase: string;
  taxDue: string;
  unusedLoss: string;
  incomplete: boolean;
  sales: CapitalGainsSaleData[];
}

interface CapitalGainsYearCardProps {
  data: CapitalGainsYearData;
  baseCurrency: string;
  /** Marks the year currently being lived through — its figures are still
   * moving, so it reads as a running estimate rather than a closed year. */
  isCurrentYear: boolean;
}

/** "always" would render an exact zero as "+0.00", which reads like a
 * rounding artefact rather than "nothing taxable here". */
function signFor(value: string): "auto" | "always" {
  return Number(value) === 0 ? "auto" : "always";
}

function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="tabular-nums">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

/**
 * One calendar year's capital-gains position: what was realized, how much
 * of the exemption it consumed, and what is left to pay.
 *
 * Both the realized and the taxable gain are shown per sale, side by side.
 * They differ for anything bought before 2026 — the tax measures against
 * the 31/12/2025 close, not the purchase price — and a single "gain" column
 * would make that difference look like a miscalculation instead of the
 * rule it is.
 */
export async function CapitalGainsYearCard({
  data,
  baseCurrency,
  isCurrentYear,
}: CapitalGainsYearCardProps) {
  const locale = await getUserLocale();
  const hasTax = Number(data.taxDue) > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">{data.year}</h2>
            {isCurrentYear && <Badge variant="secondary">so far this year</Badge>}
            {data.incomplete && (
              <Badge variant="secondary" className="gap-1">
                <TriangleAlert className="size-3" />
                incomplete
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.sales.length === 0
              ? "No sales realized"
              : `${data.sales.length} sale${data.sales.length === 1 ? "" : "s"} realized`}
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">
            {isCurrentYear ? "Estimated tax so far" : "Estimated tax"}
          </div>
          <div
            className={`text-2xl font-semibold tabular-nums ${hasTax ? "text-red-600 dark:text-red-400" : ""}`}
          >
            <Money value={data.taxDue} currency={baseCurrency} />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
          <Stat
            label="Taxable gains"
            value={<Money value={data.gains} currency={baseCurrency} />}
          />
          <Stat
            label="Losses offset"
            value={<Money value={data.losses} currency={baseCurrency} />}
            hint={
              Number(data.unusedLoss) > 0 ? (
                <>
                  <Money value={data.unusedLoss} currency={baseCurrency} /> expires unused
                </>
              ) : undefined
            }
          />
          <Stat
            label="Net gain"
            value={
              <span className={pnlToneClass(data.netGain)}>
                <Money
                  value={data.netGain}
                  currency={baseCurrency}
                  signDisplay={signFor(data.netGain)}
                />
              </span>
            }
          />
          <Stat
            label="Exemption used"
            value={<Money value={data.exemptionUsed} currency={baseCurrency} />}
            hint={
              <>
                of <Money value={data.exemptionAvailable} currency={baseCurrency} />
                {Number(data.exemptionCarriedIn) > 0 && (
                  <>
                    {" "}
                    (incl. <Money value={data.exemptionCarriedIn} currency={baseCurrency} />{" "}
                    carried in)
                  </>
                )}
              </>
            }
          />
          <Stat
            label="Taxable base"
            value={<Money value={data.taxableBase} currency={baseCurrency} />}
          />
        </div>

        {data.sales.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Security</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Proceeds</TableHead>
                  <TableHead className="text-right">Realized</TableHead>
                  <TableHead className="text-right">Taxable</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.sales.map((sale) => (
                  <TableRow key={sale.transactionId}>
                    <TableCell className="whitespace-nowrap">
                      {formatDate(sale.date, { locale })}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{sale.ticker}</div>
                      <div className="flex flex-wrap gap-1">
                        {sale.steppedUp && (
                          <Badge variant="secondary" title="Taxed against the 31/12/2025 close, not the purchase price">
                            2025 reference value
                          </Badge>
                        )}
                        {sale.usedHistoricCostOption && (
                          <Badge variant="secondary" title="The reference value would have taxed a gain you never made — the actual purchase price is claimed instead, which you may do until 2030">
                            purchase price claimed
                          </Badge>
                        )}
                        {sale.missingReferencePrice && (
                          <Badge variant="secondary" title="No cached 31/12/2025 close for this security — the whole realized gain is counted, which likely overstates the tax. Sync price history to fix it.">
                            no 2025 price
                          </Badge>
                        )}
                        {sale.missingFx && (
                          <Badge variant="secondary" title="No historical exchange rate for this sale — counted in its own currency">
                            FX missing
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Quantity value={sale.quantity} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <Money value={sale.proceeds} currency={baseCurrency} />
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${pnlToneClass(sale.accountingGain)}`}
                    >
                      <Money
                        value={sale.accountingGain}
                        currency={baseCurrency}
                        signDisplay={signFor(sale.accountingGain)}
                      />
                    </TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${pnlToneClass(sale.taxableGain)}`}
                    >
                      <Money
                        value={sale.taxableGain}
                        currency={baseCurrency}
                        signDisplay={signFor(sale.taxableGain)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {Number(data.exemptionCarriedOut) > 0 ? (
            <>
              <Money value={data.exemptionCarriedOut} currency={baseCurrency} /> of unused
              exemption carries into {data.year + 1}.
            </>
          ) : (
            <>Nothing carries into {data.year + 1} — more than the first 1,000 of the exemption was used.</>
          )}
          {Number(data.exemptionRemaining) > 0 && (
            <>
              {" "}
              A further <Money value={data.exemptionRemaining} currency={baseCurrency} /> of gain
              is still tax-free in {data.year}.
            </>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
