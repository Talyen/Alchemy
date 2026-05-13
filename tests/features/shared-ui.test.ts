import { describe, expect, it } from "vitest";
import { staggerDelay } from "@/features/alchemy/ui/shared-ui";
import { ANIMATION_STAGGER_UNIT } from "@/lib/game-constants";

describe("staggerDelay", () => {
  it("returns 0 for position 0", () => {
    expect(staggerDelay(0)).toBe(0);
  });

  it("multiplies position by ANIMATION_STAGGER_UNIT", () => {
    expect(staggerDelay(1)).toBe(ANIMATION_STAGGER_UNIT);
    expect(staggerDelay(3)).toBe(ANIMATION_STAGGER_UNIT * 3);
    expect(staggerDelay(10)).toBe(ANIMATION_STAGGER_UNIT * 10);
  });
});
