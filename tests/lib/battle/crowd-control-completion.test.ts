import { describe, expect, it } from "vitest";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { cardById, computeTalentEffects } from "@/lib/game-data";
import { patchBattleState } from "../../fixtures/battle";

describe("crowd control requires a surviving target", () => {
  it.each(["frostbolt", "bash"])("a lethal %s cannot control a defeated enemy or grant control rewards", (id) => {
    const card = { ...cardById[id]!, uid: 1 };
    const state = patchBattleState({
      hand: [card],
      enemyHealth: 3,
      enemyMaxHealth: 30,
      talentEffects: computeTalentEffects({
        freeze: ["freeze-block-healing"],
        stun: ["stun-next-free", "stun-block-grant"],
      }),
      rng: () => 0.99,
    });
    const result = playBattleCardResolved(state, id, 0);
    expect(result.state.enemyHealth).toBe(0);
    expect(result.state.enemyCC.stunSkipTurns + result.state.enemyCC.freezeSkipTurns).toBe(0);
    expect(result.state.playerStatuses.block).toBe(0);
    expect(result.state.flags.nextCardCostReduction).toBe(0);
    expect(result.combatTexts.some((event) => event.kind === "notice" && ["stun", "freeze"].includes(event.stat))).toBe(
      false,
    );
  });
});
