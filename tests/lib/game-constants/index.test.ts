import { describe, expect, it } from "vitest";
import * as barrel from "@/lib/game-constants";
import * as audio from "@/lib/game-constants/audio";
import * as combatRules from "@/lib/game-constants/combat-rules";

describe("game-constants barrel", () => {
  it("re-exports submodules via index", () => {
    expect(barrel).toHaveProperty("XP_BASE_PER_POINT");
    expect(barrel).toHaveProperty("ENEMY_BASE_REGENERATION");
    expect(barrel).toHaveProperty("SAVE_KEY");

    for (const key of Object.keys(audio)) {
      expect(barrel).toHaveProperty(key);
    }
    for (const key of Object.keys(combatRules)) {
      expect(barrel).toHaveProperty(key);
    }
  });
});
