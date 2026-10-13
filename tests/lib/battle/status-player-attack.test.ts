import { describe, expect, it } from "vitest";
import { processEnemyDamageEffect } from "@/lib/battle/enemy-attack-damage";
import { applyPlayerStatusFromAttack } from "@/lib/battle/status-player";
import type { CombatTextEvent } from "@/lib/battle/types";
import { patchBattleState } from "../../fixtures/battle";

describe("applyPlayerStatusFromAttack", () => {
  it("routes attack-granted Block through its bonuses once while other beneficial statuses retain their own stacks", () => {
    const state = patchBattleState({
      playerStatuses: { block: 3, armor: 2 },
      gearEffects: { flatBlockGained: 2 },
      trinketEffects: { ironwoodBucklerThornsOnBlock: 1 },
    });
    const texts: CombatTextEvent[] = [];
    const blocked = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "block", amount: 4 }, texts);
    expect(blocked.playerStatuses).toMatchObject({ block: 9, armor: 2, thorns: 1 });
    expect(texts).toEqual([
      { target: "player", kind: "status", stat: "block", amount: 6 },
      { target: "player", kind: "status", stat: "thorns", amount: 1 },
    ]);
    const armored = applyPlayerStatusFromAttack(blocked, { kind: "player-status", status: "armor", amount: 4 }, texts);
    expect(armored.playerStatuses).toMatchObject({ block: 9, armor: 6, thorns: 1 });
    expect(state.playerStatuses).toMatchObject({ block: 3, armor: 2, thorns: 0 });
  });

  it("the Mask allows incoming Poison before cleansing on the next turn", () => {
    const state = patchBattleState({
      trinketEffects: { plagueDoctorPoisonCleanse: 2 },
    });
    const result = applyPlayerStatusFromAttack(state, { kind: "player-status", status: "poison", amount: 3 }, []);
    expect(result.playerStatuses.poison).toBe(3);
  });
});

describe("damage status riders during crowd-control immunity", () => {
  it.each([
    { stunSkipTurns: 1, freezeSkipTurns: 0, cooldown: 0 },
    { stunSkipTurns: 0, freezeSkipTurns: 1, cooldown: 0 },
    { stunSkipTurns: 0, freezeSkipTurns: 0, cooldown: 1 },
  ])("blocks buildup while preserving damage with %j", (playerCC) => {
    for (const damageType of ["stun", "freeze"] as const) {
      const state = patchBattleState({ playerCC });
      const result = processEnemyDamageEffect(state, { kind: "damage", damageType, amount: 2 }, []);
      expect(result.playerHealth).toBe(state.playerHealth - 2);
      expect(result.playerStatuses[damageType]).toBe(0);
      expect(result.playerCC).toEqual(playerCC);
      expect(state.playerStatuses[damageType]).toBe(0);
    }
  });
});
