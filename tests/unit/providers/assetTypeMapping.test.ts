import { describe, expect, it } from "vitest";
import { mapProviderAssetType } from "@/lib/providers/financialData/assetTypeMapping";

describe("mapProviderAssetType", () => {
  it("maps common stock/equity variants to STOCK", () => {
    expect(mapProviderAssetType("Common Stock")).toBe("STOCK");
    expect(mapProviderAssetType("Equity")).toBe("STOCK");
    expect(mapProviderAssetType("REIT")).toBe("STOCK");
  });

  it("maps ETF", () => {
    expect(mapProviderAssetType("ETF")).toBe("ETF");
  });

  it("maps fund/trust variants to FUND", () => {
    expect(mapProviderAssetType("Investment Trust")).toBe("FUND");
    expect(mapProviderAssetType("Mutual Fund")).toBe("FUND");
  });

  it("maps bond and crypto", () => {
    expect(mapProviderAssetType("Government Bond")).toBe("BOND");
    expect(mapProviderAssetType("Cryptocurrency")).toBe("CRYPTO");
  });

  it("falls back to OTHER for null or unrecognized input", () => {
    expect(mapProviderAssetType(null)).toBe("OTHER");
    expect(mapProviderAssetType("Something Unusual")).toBe("OTHER");
  });
});
