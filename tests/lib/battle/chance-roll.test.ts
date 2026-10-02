import { describe, expect, it, vi } from "vitest";
import { rollBattleChance } from "@/lib/battle/chance-roll";

describe("battle chance rolls", () => {
  it("skips disabled effects without requiring or consuming RNG", () => {
    const rng = vi.fn(() => 0.5);
    expect(rollBattleChance(0, {})).toBe(false);
    expect(rollBattleChance(-1, { rng })).toBe(false);
    expect(rng).not.toHaveBeenCalled();
  });

  it("uses the supplied battle stream once for each uncertain effect", () => {
    const rng = vi.fn().mockReturnValueOnce(0.49).mockReturnValueOnce(0.5);
    expect(rollBattleChance(50, { rng })).toBe(true);
    expect(rollBattleChance(50, { rng })).toBe(false);
    expect(rng).toHaveBeenCalledTimes(2);
    expect(() => rollBattleChance(50, {})).toThrow("BattleState.rng is required");
  });

  it("preserves guaranteed effects without advancing the stream", () => {
    const rng = vi.fn(() => 0.99);
    expect(rollBattleChance(100, { rng })).toBe(true);
    expect(rng).not.toHaveBeenCalled();
  });
});
