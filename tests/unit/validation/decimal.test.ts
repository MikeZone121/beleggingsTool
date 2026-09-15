import { describe, expect, it } from "vitest";
import { decimalString, positiveDecimalString } from "@/lib/validation/decimal";

describe("decimalString", () => {
  it("normalizes a European decimal comma to a dot", () => {
    const result = decimalString.safeParse("115,50");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe("115.50");
  });

  it("accepts a plain dot decimal unchanged", () => {
    const result = decimalString.safeParse("115.50");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe("115.50");
  });

  it("accepts a whole number with a comma but no fractional part", () => {
    expect(decimalString.safeParse("100,").success).toBe(true);
  });

  it("accepts negative numbers (fees/taxes can be negative-ish in edge cases)", () => {
    expect(decimalString.safeParse("-5,25").success).toBe(true);
  });

  it("rejects non-numeric input rather than throwing", () => {
    const result = decimalString.safeParse("abc");
    expect(result.success).toBe(false);
  });

  it("rejects a string with more than one comma rather than mangling it", () => {
    // Only the first comma is normalized; a second one makes it unparseable.
    const result = decimalString.safeParse("1,2,3");
    expect(result.success).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(decimalString.safeParse("").success).toBe(false);
  });
});

describe("positiveDecimalString", () => {
  it("normalizes a comma and accepts a positive value", () => {
    const result = positiveDecimalString.safeParse("99,95");
    expect(result.success).toBe(true);
    expect(result.success && result.data).toBe("99.95");
  });

  it("rejects zero", () => {
    expect(positiveDecimalString.safeParse("0").success).toBe(false);
  });

  it("rejects a negative value", () => {
    expect(positiveDecimalString.safeParse("-1,5").success).toBe(false);
  });

  it("never throws on garbage input (chained refine safety)", () => {
    // Regression test: an earlier version of this schema chained a second
    // `.refine()` that assumed the first refine's success, and called
    // `new Decimal(val)` without its own try/catch — Zod does not
    // short-circuit chained refines, so invalid input reached it and threw
    // an uncaught DecimalError instead of a normal validation failure.
    expect(() => positiveDecimalString.safeParse("not a number")).not.toThrow();
    expect(positiveDecimalString.safeParse("not a number").success).toBe(false);
    expect(() => positiveDecimalString.safeParse("1,2,3")).not.toThrow();
  });
});
