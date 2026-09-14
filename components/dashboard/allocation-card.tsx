"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AllocationBar, type AllocationChartBucket } from "@/components/charts/allocation-bar";
import { ASSET_TYPES } from "@/lib/validation/security";

export interface AllocationCardProps {
  byAssetType: AllocationChartBucket[];
  bySector: AllocationChartBucket[];
  byCurrency: AllocationChartBucket[];
  baseCurrency: string;
}

export function AllocationCard({
  byAssetType,
  bySector,
  byCurrency,
  baseCurrency,
}: AllocationCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Allocation</CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="assetType">
          <TabsList>
            <TabsTrigger value="assetType">Asset type</TabsTrigger>
            <TabsTrigger value="sector">Sector</TabsTrigger>
            <TabsTrigger value="currency">Currency</TabsTrigger>
          </TabsList>
          <TabsContent value="assetType" className="pt-4">
            <AllocationBar
              buckets={byAssetType}
              currency={baseCurrency}
              identityOrder={ASSET_TYPES}
            />
          </TabsContent>
          <TabsContent value="sector" className="pt-4">
            <AllocationBar buckets={bySector} currency={baseCurrency} />
          </TabsContent>
          <TabsContent value="currency" className="pt-4">
            <AllocationBar buckets={byCurrency} currency={baseCurrency} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
