import { describe, expect, it } from "vitest";
import { processEnemyAttack } from "@/lib/battle/enemy-turn-attack";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";

function makeTexts(): CombatTextEvent[] {
  return [];
}

describe("processEnemyAttack", () => {
  it("player block absorbs before health", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 10, armor: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.block).toBe(5);
    expect(result.playerHealth).toBe(30);
  });

  it("applies enemy forge bonus to physical damage", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 0 },
      enemyMitigation: { ...createTestBattleState().enemyMitigation, forge: 3 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 5 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(22);
  });

  it("applies burn status rider on burn damage dealt", () => {
    const state = createTestBattleState({
      playerHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0 },
      enemyAttackEffects: [{ kind: "damage", damageType: "burn", amount: 4 }],
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerStatuses.burn).toBe(4);
    expect(result.playerHealth).toBe(26);
  });

  it("triggers Death's Door fields when attack is lethal", () => {
    const state = createTestBattleState({
      playerHealth: 5,
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 0, armor: 0 },
      deathsDoorUsed: false,
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 10 }],
      turn: 3,
    });
    const result = processEnemyAttack(state, makeTexts());
    expect(result.playerHealth).toBe(0);
    expect(result.deathsDoorUsed).toBe(true);
    expect(result.deathsDoorActive).toBe(true);
    expect(result.deathsDoorTriggeredTurn).toBe(3);
  });
});
