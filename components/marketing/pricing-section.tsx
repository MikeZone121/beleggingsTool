"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "cn";

interface Plan {
  name: string;
  tagline: string;
  monthlyPrice: number;
  yearlyMonthlyPrice: number;
  cta: string;
  highlighted?: boolean;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: "Starter",
    tagline: "Om te starten met het opvolgen van je portefeuille.",
    monthlyPrice: 0,
    yearlyMonthlyPrice: 0,
    cta: "Start gratis",
    features: [
      "1 portefeuille",
      "Tot 10 posities",
      "Live koersen & dagelijks dashboard",
      "Transacties handmatig invoeren",
      "Watchlist tot 5 tickers",
    ],
  },
  {
    name: "Pro",
    tagline: "Voor actieve beleggers die hun volledige portefeuille willen doorgronden.",
    monthlyPrice: 7.99,
    yearlyMonthlyPrice: 5.99,
    cta: "Start met Pro",
    highlighted: true,
    features: [
      "Onbeperkt aantal posities",
      "Dividendkalender & doorbetalingsritme",
      "Volledige analytics en spreiding",
      "Onbeperkte watchlist met technische grafieken",
      "CSV-import van transacties",
      "Slimme insights & meldingen",
    ],
  },
  {
    name: "Premium",
    tagline: "Voor wie meerdere portefeuilles beheert of fiscaal alles op een rijtje wil.",
    monthlyPrice: 14.99,
    yearlyMonthlyPrice: 11.99,
    cta: "Start met Premium",
    features: [
      "Alles uit Pro",
      "Onbeperkt aantal portefeuilles (bv. per gezinslid)",
      "Belastingoverzicht: roerende voorheffing & meerwaarden",
      "Data-export naar CSV/PDF",
      "Prioritaire e-mailsupport",
    ],
  },
];

export function PricingSection() {
  const [yearly, setYearly] = useState(false);

  return (
    <section id="prijzen" className="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="text-3xl font-semibold tracking-tight">Eenvoudige, eerlijke prijzen</h2>
        <p className="mt-3 text-muted-foreground">
          Begin gratis. Groeit je portefeuille, upgrade dan mee. Altijd op te zeggen.
        </p>
      </div>

      <div className="mt-6 flex items-center justify-center gap-3 text-sm">
        <span className={cn(!yearly && "font-medium text-foreground", yearly && "text-muted-foreground")}>
          Maandelijks
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={yearly}
          onClick={() => setYearly((v) => !v)}
          className="relative inline-flex h-[18.4px] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input transition-all data-checked:bg-primary dark:bg-input/80"
          data-checked={yearly || undefined}
        >
          <span
            className={cn(
              "block size-4 rounded-full bg-background transition-transform",
              yearly && "translate-x-[calc(100%-2px)]"
            )}
          />
        </button>
        <span className={cn(yearly && "font-medium text-foreground", !yearly && "text-muted-foreground")}>
          Jaarlijks
        </span>
        <Badge variant="secondary">2 maanden gratis</Badge>
      </div>

      <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {PLANS.map((plan) => {
          const price = yearly ? plan.yearlyMonthlyPrice : plan.monthlyPrice;
          return (
            <Card
              key={plan.name}
              className={cn(
                "flex flex-col",
                plan.highlighted && "border-primary ring-1 ring-primary"
              )}
            >
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  {plan.highlighted && <Badge>Populairste keuze</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </CardHeader>
              <CardContent className="flex-1">
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">
                    {price === 0 ? "€0" : `€${price.toFixed(2).replace(".", ",")}`}
                  </span>
                  <span className="text-sm text-muted-foreground">/ maand</span>
                </div>
                {yearly && price > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Jaarlijks gefactureerd</p>
                )}
                <ul className="mt-6 flex flex-col gap-3 text-sm">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full"
                  variant={plan.highlighted ? "default" : "outline"}
                  render={<Link href="/signup" />}
                  nativeButton={false}
                >
                  {plan.cta}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xs text-muted-foreground">
        Alle prijzen zijn exclusief btw. Tijdens de beta gebeurt facturatie nog niet automatisch —
        genodigden krijgen de details per e-mail.
      </p>
    </section>
  );
}
