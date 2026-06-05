import { describe, expect, it } from "vitest";
import { getBattleStartPlayerHealth } from "@/features/alchemy/run-loop/battle/battle-init";

describe("getBattleStartPlayerHealth", () => {
  it("preserves current Health when no start-heal trinket is equipped", () => {
    expect(getBattleStartPlayerHealth(12, 30, [])).toBe(12);
  });

  it("applies Grove's Favor before creating battle state", () => {
    expect(getBattleStartPlayerHealth(12, 30, ["groves-favor"])).toBe(14);
  });

  it("caps Grove's Favor healing at max Health", () => {
    expect(getBattleStartPlayerHealth(29, 30, ["groves-favor"])).toBe(30);
  });
});
