import { describe, expect, it } from "vitest";
import { clampProgressPercent } from "@/lib/ui/progress";

describe("clampProgressPercent", () => {
  it("keeps valid percentages unchanged", () => {
    expect(clampProgressPercent(0)).toBe(0);
    expect(clampProgressPercent(42)).toBe(42);
    expect(clampProgressPercent(100)).toBe(100);
  });

  it("clamps invalid or out-of-range values", () => {
    expect(clampProgressPercent(undefined)).toBe(0);
    expect(clampProgressPercent(Number.NaN)).toBe(0);
    expect(clampProgressPercent(-10)).toBe(0);
    expect(clampProgressPercent(130)).toBe(100);
  });
});
