import { makeTestCard as makeEnemyTestCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { endPlayerTurn } from "@/lib/battle/enemy-turn";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { processEnemyRegeneration, processEnemyTraits } from "@/lib/battle/enemy-turn-traits";
import { processEncounterTraitActionStart } from "@/lib/battle/encounter-trait-events";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { normalizePersistedBattleState } from "@/lib/validation/normalize-persisted-battle-state";
import { makeTestCard, patchBattleState } from "../../fixtures/battle";

const metrics = () => ({ enemyAttackActions: 0, enemyAbilityActivations: {} });

describe("battle measurements", () => {
  it("counts a blocked multi-hit attack once without changing combat", () => {
    const state = patchBattleState({
      playerStatuses: { block: 50 },
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
    const base = patchBattleState();
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

  it("records Iron Hide only on its scheduled turns, including while Frozen", () => {
    const base = patchBattleState();
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
    };
    expect(processEnemyTraits(frozen, []).battleMetrics?.enemyAbilityActivations).toEqual({ "iron-hide": 1 });
    expect(state.battleMetrics).toEqual(metrics());
  });

  it("counts Glacial Surge only while its scheduled gain can increase Freeze Bonus", () => {
    const state = patchBattleState({
      turn: 2,
      battleMetrics: metrics(),
      currentEnemy: { traits: [{ id: "glacial-shell", title: "Glacial Surge", description: "" }] },
    });
    const first = processEnemyTraits(state, []);
    const second = processEnemyTraits({ ...first, turn: 4 }, []);
    expect(second.enemyStatuses.freezeBonus).toBe(2);
    expect(second.battleMetrics?.enemyAbilityActivations).toEqual({ "glacial-shell": 2 });
    const capped = { ...second, turn: 6 };
    expect(processEnemyTraits(capped, [])).toBe(capped);
  });

  it("counts healing traits only when they restore Health, without changing combat", () => {
    const resolve = (state: ReturnType<typeof patchBattleState>) =>
      processEnemyRegeneration(processEncounterTraitActionStart(state, []), []);
    for (const health of [20, 30]) {
      const state = patchBattleState({
        enemyHealth: health,
        enemyMaxHealth: 30,
        enemyRegeneration: 3,
        currentEnemy: { traits: ["overgrowth", "regeneration"].map((id) => ({ id, title: id, description: "" })) },
      });
      const measured = resolve({ ...state, battleMetrics: metrics() });
      const { battleMetrics, ...combat } = measured;
      expect(battleMetrics?.enemyAbilityActivations).toEqual(health === 30 ? {} : { overgrowth: 1, regeneration: 1 });
      expect(combat).toEqual(resolve(state));
      expect(measured.enemyHealth).toBe(Math.min(30, health + 4));
    }
  });

  it("drops simulation-only measurements when loading a battle save", () => {
    expect(
      normalizePersistedBattleState({ ...patchBattleState(), battleMetrics: metrics() }).battleMetrics,
    ).toBeUndefined();
  });
});

describe("Shield Slam", () => {
  it.each([
    [1, 3],
    [0, 5],
  ])("removes two Armor only while Block is held (%i Block)", (block, armor) => {
    const base = patchBattleState();
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
