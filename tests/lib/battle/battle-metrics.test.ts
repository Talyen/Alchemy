import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { processEnemyTraits } from "@/lib/battle/enemy-turn-traits";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { normalizePersistedBattleState } from "@/lib/validation/normalize-persisted-battle-state";
import { makeTestBattleState, makeTestCard } from "../../fixtures/battle";

const metrics = () => ({ enemyAttackActions: 0, enemyAbilityActivations: {} });

describe("battle measurements", () => {
  it("counts a blocked multi-hit attack once without changing combat", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, block: 50 },
      rng: () => 0.99,
    });
    const measured = applyEnemyAbility(
      { ...state, battleMetrics: metrics() },
      makeEnemyTestCard({
        effects: [
          { kind: "damage", damageType: "physical", amount: 2 },
          { kind: "damage", damageType: "burn", amount: 2 },
        ],
      }),
      [],
    );
    const plain = applyEnemyAbility(
      state,
      makeEnemyTestCard({
        effects: [
          { kind: "damage", damageType: "physical", amount: 2 },
          { kind: "damage", damageType: "burn", amount: 2 },
        ],
      }),
      [],
    );
    const { battleMetrics, ...combat } = measured;
    expect(battleMetrics?.enemyAttackActions).toBe(1);
    expect(combat).toEqual(plain);
    expect(measured.playerHealth).toBe(state.playerHealth);
  });

  it("counts no attacks for Haste or enemy crowd control", () => {
    const base = makeTestBattleState();
    const haste = endPlayerTurn({
      ...base,
      battleMetrics: metrics(),
      playerStatuses: { ...base.playerStatuses, haste: 1 },
    }).state;
    const stunned = endPlayerTurn({
      ...base,
      battleMetrics: metrics(),
      enemyCC: { ...base.enemyCC, stunSkipTurns: 1 },
    }).state;
    expect(haste.battleMetrics?.enemyAttackActions).toBe(0);
    expect(stunned.battleMetrics?.enemyAttackActions).toBe(0);
  });

  it("records Iron Hide only on its scheduled turns and respects Freeze suppression", () => {
    const base = makeTestBattleState();
    const state = {
      ...base,
      battleMetrics: metrics(),
      currentEnemy: { ...base.currentEnemy, traits: [{ id: "iron-hide", title: "Iron Hide", description: "" }] },
    };
    expect(processEnemyTraits({ ...state, turn: 1 }, []).battleMetrics?.enemyAbilityActivations).toEqual({});
    expect(processEnemyTraits({ ...state, turn: 2 }, []).battleMetrics?.enemyAbilityActivations).toEqual({
      "iron-hide": 1,
    });
    const frozen = {
      ...state,
      turn: 2,
      enemyCC: { ...state.enemyCC, freezeSkipTurns: 1 },
      talentEffects: { ...state.talentEffects, freezePreventsEnemyScaling: true },
    };
    expect(processEnemyTraits(frozen, []).battleMetrics?.enemyAbilityActivations).toEqual({});
    expect(state.battleMetrics).toEqual(metrics());
  });

  it("drops simulation-only measurements when loading a battle save", () => {
    expect(
      normalizePersistedBattleState({ ...makeTestBattleState(), battleMetrics: metrics() }).battleMetrics,
    ).toBeUndefined();
  });
});

describe("Shield Slam", () => {
  it.each([
    [1, 3],
    [0, 5],
  ])("removes two Armor only while Block is held (%i Block)", (block, armor) => {
    const base = makeTestBattleState();
    const state = {
      ...base,
      playerStatuses: { ...base.playerStatuses, block },
      enemyMitigation: { ...base.enemyMitigation, armor: 5 },
      talentEffects: { ...base.talentEffects, physicalStripArmorWhileBlocked: true },
      rng: () => 0.99,
    };
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 1 }] });
    expect(applyCardEffects(state, card, []).enemyMitigation.armor).toBe(armor);
  });
});
