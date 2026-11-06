import { describe, expect, it } from "vitest";
import { toSplitEvent } from "@/lib/db/mappers";
import type { CorporateAction } from "@/generated/prisma/client";

function row(details: unknown): CorporateAction {
  return {
    id: "ca-1",
    securityId: "sec-1",
    type: "SPLIT",
    effectiveDate: new Date("2026-06-10"),
    details: details as CorporateAction["details"],
    createdAt: new Date("2026-06-11"),
  };
}

describe("toSplitEvent", () => {
  it("maps a stored multiplier onto a SplitEvent", () => {
    const event = toSplitEvent(row({ ratio: "10", source: "yahoo" }));
    expect(event?.securityId).toBe("sec-1");
    expect(event?.ratio.toString()).toBe("10");
    expect(event?.effectiveDate.toISOString()).toBe(new Date("2026-06-10").toISOString());
  });

  it("maps a reverse split's fractional multiplier", () => {
    expect(toSplitEvent(row({ ratio: "0.1" }))?.ratio.toString()).toBe("0.1");
  });

  it("accepts a numeric ratio as well as a string one", () => {
    expect(toSplitEvent(row({ ratio: 3 }))?.ratio.toString()).toBe("3");
  });

  it("returns null rather than defaulting when the ratio is unusable", () => {
    // Defaulting to 1 would silently no-op the split; defaulting to 0 would
    // wipe the position. Both are worse than refusing the row.
    expect(toSplitEvent(row({ ratio: "not a number" }))).toBeNull();
    expect(toSplitEvent(row({ ratio: "0" }))).toBeNull();
    expect(toSplitEvent(row({ ratio: "-2" }))).toBeNull();
    expect(toSplitEvent(row({}))).toBeNull();
    expect(toSplitEvent(row(null))).toBeNull();
  });
});
