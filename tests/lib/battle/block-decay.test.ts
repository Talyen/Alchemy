import { describe, expect, it } from "vitest";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import type { BattleState } from "@/lib/battle/types";
import { defaultTalentEffects } from "@/lib/battle";
import { ENCOUNTER_TRAITS } from "@/lib/content-systems/encounter-traits";
import { createTestBattleState } from "./test-state";

function makeState(overrides: Partial<BattleState> = {}): BattleState {
  return createTestBattleState({
    playerHealth: 30,
    playerMaxHealth: 30,
    playerStatuses: { ...createTestBattleState().playerStatuses, block: 10 },
    enemyHealth: 30,
    enemyMaxHealth: 30,
    enemyStatuses: { ...createTestBattleState().enemyStatuses },
    enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    deck: [createTestBattleState().deck[0]],
    mana: 4,
    maxMana: 4,
    talentEffects: defaultTalentEffects,
    ...overrides,
  });
}

describe("block decay timing", () => {
  it("absorbs enemy damage before block decays", () => {
    const state = makeState({ playerStatuses: { ...createTestBattleState().playerStatuses, block: 10 } });
    const result = endPlayerTurn(state);
    // Enemy attacks for 4 physical damage → absorbed by block (10 → 6).
    // Then block decays from 6 to round(6/2) = 3 during turn transition.
    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.block).toBe(3);
  });

  it("block decays when no damage is taken", () => {
    const state = makeState({ enemyAttackEffects: [] });
    const result = endPlayerTurn(state);
    // No damage taken, block decays from 10 to 5
    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.block).toBe(5);
  });

  it("block absorbs partial damage then decays remainder", () => {
    const state = makeState({ playerStatuses: { ...createTestBattleState().playerStatuses, block: 3 } });
    const result = endPlayerTurn(state);
    // Enemy attacks for 4 physical → block absorbs 3, 1 damage to health.
    // Block goes to 0 after absorption, decay of 0 rounds to 0.
    expect(result.state.playerHealth).toBe(29);
    expect(result.state.playerStatuses.block).toBe(0);
  });

  it("block decays during turn transition after enemy phase completes", () => {
    const state = makeState({
      playerStatuses: { ...createTestBattleState().playerStatuses, block: 7 },
      enemyAttackEffects: [{ kind: "damage", damageType: "physical", amount: 2 }],
    });
    const result = endPlayerTurn(state);
    // Enemy attacks for 2 → block: 7 → 5. Then block decays: round(5/2) = 3.
    expect(result.state.playerHealth).toBe(30);
    expect(result.state.playerStatuses.block).toBe(3);
  });

  it("enemy block decays at the start of the enemy phase after the player had an attack window", () => {
    const state = makeState({
      enemyAttackEffects: [],
      enemyMitigation: { ...createTestBattleState().enemyMitigation, block: 9 },
    });
    const result = endPlayerTurn(state);
    expect(result.state.enemyMitigation.block).toBe(5);
  });

  it("enemy block gained during the enemy phase survives until the next enemy phase", () => {
    const reinforcedEnemy = {
      ...createTestBattleState().currentEnemy,
      traits: [ENCOUNTER_TRAITS.reinforced.enemyTrait],
      attackEffects: [],
    };
    const first = endPlayerTurn(
      makeState({
        currentEnemy: reinforcedEnemy,
        enemyAttackEffects: [],
        enemyMitigation: { ...createTestBattleState().enemyMitigation, block: 0 },
      }),
    );
    expect(first.state.enemyMitigation.block).toBe(2);

    const second = endPlayerTurn(first.state);
    expect(second.state.enemyMitigation.block).toBe(3);
  });
});
