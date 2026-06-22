import { describe, expect, it } from "vitest";
import { isVictoryGraceActive } from "@/features/alchemy/run-loop/battle/battle-victory-grace";

describe("isVictoryGraceActive", () => {
  it("is true on battle screen after victory with enemy at zero", () => {
    expect(isVictoryGraceActive("battle", 0, true)).toBe(true);
  });

  it("is false before victory is handled", () => {
    expect(isVictoryGraceActive("battle", 0, false)).toBe(false);
  });

  it("is false after leaving battle screen", () => {
    expect(isVictoryGraceActive("rewards", 0, true)).toBe(false);
  });

  it("is false on defeat when enemy is still alive", () => {
    expect(isVictoryGraceActive("battle", 30, true)).toBe(false);
  });
});
