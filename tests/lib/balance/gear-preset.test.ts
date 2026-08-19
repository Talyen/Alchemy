import { describe, expect, it } from "vitest";
import { buildTypicalGearEffects } from "@/lib/balance/gear-preset";
import { defaultGearEffects } from "@/lib/gear/gear-effect-manifest";
import { createSeededRng } from "@/lib/utils";

describe("buildTypicalGearEffects", () => {
  it("returns empty gear for early", () => {
    const rng = createSeededRng(1);
    expect(buildTypicalGearEffects("rogue", "early", rng)).toEqual(defaultGearEffects);
  });

  it("rolls affinity-matching gear that is stable for a given rng seed", () => {
    const first = buildTypicalGearEffects("ranger", "late", createSeededRng(88));
    const second = buildTypicalGearEffects("ranger", "late", createSeededRng(88));
    expect(first).toEqual(second);
    expect(first).not.toEqual(defaultGearEffects);
  });
});
