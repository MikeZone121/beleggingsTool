"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface AnalyticsTabsProps {
  performance: ReactNode;
  risk: ReactNode;
  costs: ReactNode;
}

/**
 * Analytics had grown into one long scroll of eight distinct concerns
 * (return, drawdown, volatility, stress test, diversification, fees,
 * benchmark chart, methodology) — splitting it into tabs by "what
 * question does this answer" (how am I doing / how risky is this / what
 * am I paying) makes each view digestible on its own, the same pattern
 * Allocation and Rebalancing already use for their own sub-views. The
 * three sections are pre-rendered on the server and passed in as
 * `children`-like props — this component only owns which one is
 * visible, not any of the data fetching or KPI rendering itself.
 */
export function AnalyticsTabs({ performance, risk, costs }: AnalyticsTabsProps) {
  return (
    <Tabs defaultValue="performance">
      <TabsList>
        <TabsTrigger value="performance">Performance</TabsTrigger>
        <TabsTrigger value="risk">Risk</TabsTrigger>
        <TabsTrigger value="costs">Costs</TabsTrigger>
      </TabsList>
      <TabsContent value="performance" className="flex flex-col gap-6 pt-4">
        {performance}
      </TabsContent>
      <TabsContent value="risk" className="flex flex-col gap-6 pt-4">
        {risk}
      </TabsContent>
      <TabsContent value="costs" className="flex flex-col gap-6 pt-4">
        {costs}
      </TabsContent>
    </Tabs>
  );
}
