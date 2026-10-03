import { describe, expect, it } from "vitest";
import { animationNoise } from "@/lib/animation/animation-noise";

describe("animationNoise", () => {
  it("returns deterministic pseudo-random values in [0, 1)", () => {
    const val1 = animationNoise(1, 10);
    const val2 = animationNoise(1, 10);
    const val3 = animationNoise(2, 10);

    expect(val1).toBe(val2);
    expect(val1).toBeGreaterThanOrEqual(0);
    expect(val1).toBeLessThan(1);
    expect(val3).not.toBe(val1);
  });
});
