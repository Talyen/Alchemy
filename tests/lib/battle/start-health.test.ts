import { describe, expect, it } from "vitest";
import { getBattleStartPlayerHealth } from "@/lib/battle/start-health";

describe("getBattleStartPlayerHealth", () => {
  it("returns runPlayerHealth when no Groves Favor trinket", () => {
    expect(getBattleStartPlayerHealth(40, 50, [])).toBe(40);
  });
  it("returns runPlayerHealth when trinkets list does not include groves favor", () => {
    expect(getBattleStartPlayerHealth(40, 50, ["some-other-trinket"])).toBe(40);
  });
  it("adds groves favor heal and caps at maxHealth", () => {
    expect(getBattleStartPlayerHealth(40, 50, ["groves-favor"])).toBe(42);
  });
  it("caps at maxHealth when heal would overflow", () => {
    expect(getBattleStartPlayerHealth(49, 50, ["groves-favor"])).toBe(50);
  });
  it("returns 0 when runPlayerHealth is 0", () => {
    expect(getBattleStartPlayerHealth(0, 50, [])).toBe(0);
  });
});
