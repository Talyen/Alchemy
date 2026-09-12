import { describe, expect, it } from "vitest";
import { cardById } from "@/lib/game-data";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import type { CombatTextEvent } from "@/lib/battle/types";
import { patchBattleState } from "../../fixtures/battle";

describe("enemy Cold Snap feedback", () => {
  it("reports the Freeze buildup added by doubling, rather than the multiplier", () => {
    const state = patchBattleState({
      rng: () => 0.99,
      playerHealth: 100,
      playerMaxHealth: 100,
      playerStatuses: { freeze: 4 },
    });
    const texts: CombatTextEvent[] = [];
    const result = applyEnemyAbility(state, cardById["cold-snap"]!, texts);
    expect(result.playerStatuses.freeze).toBe(10);
    expect(texts).toContainEqual({ target: "player", kind: "multiply", stat: "freeze", amount: 5 });
  });
});
