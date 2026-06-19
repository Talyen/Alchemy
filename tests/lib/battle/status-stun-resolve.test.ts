import { describe, expect, it } from "vitest";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";
import {
  defaultEnemyMitigation,
  defaultCcState,
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
} from "../../fixtures/default-battle-state";

function makeTexts(): CombatTextEvent[] {
  return [];
}
describe("resolveStunTrigger", () => {
  it("does nothing when stun is below threshold", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ stun: 5 }),
    });
    const result = resolveStunTrigger(state);
    expect(result).toBe(state);
  });

  it("resets stun and skips turns when stun exceeds threshold", () => {
    const base = createTestBattleState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
    };
    const result = resolveStunTrigger(state);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
  });

  it("does nothing when enemy is dead", () => {
    const state = createTestBattleState({
      enemyHealth: 0,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
    });
    const result = resolveStunTrigger(state);
    expect(result).toBe(state);
  });

  it("skips additional turns with stunDurationExtension", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { ...createTestBattleState().talentEffects, stunDurationExtension: 2 },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyCC.stunSkipTurns).toBe(3);
  });

  it("draws cards with drawOnStun", () => {
    const card = {
      id: "strike",
      title: "Strike",
      descriptionLines: [""],
      art: "",
      cost: 1,
      effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
    };
    const state = createTestBattleState({
      deck: [card, card, card],
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { ...createTestBattleState().talentEffects, drawOnStun: 2 },
    });
    const result = resolveStunTrigger(state);
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
  });

  it("sets nextCardCostReduction with nextCardFreeOnStun", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { ...createTestBattleState().talentEffects, nextCardFreeOnStun: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.flags.nextCardCostReduction).toBe(99);
  });

  it("deals thunderstone damage and generates combat text", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      trinketEffects: { ...createTestBattleState().trinketEffects, thunderstoneDamageOnStun: 5 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.enemyHealth).toBe(25);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "nature", amount: 5 });
  });

  it("thunderstone damage does not generate combat text when texts omitted", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      trinketEffects: { ...createTestBattleState().trinketEffects, thunderstoneDamageOnStun: 5 },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyHealth).toBe(25);
  });

  it("applies lucky clover gold from thunderstone even when texts are omitted", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      trinketEffects: {
        ...createTestBattleState().trinketEffects,
        thunderstoneDamageOnStun: 5,
        luckyCloverGoldChance: 100,
      },
      rng: () => 0,
    });

    const result = resolveStunTrigger(state);

    expect(result.gold).toBe(5);
  });

  it("uses stunThresholdReduction to lower threshold", () => {
    const base = createTestBattleState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 10 }),
      talentEffects: { ...base.talentEffects, stunThresholdReduction: 0.2 },
    };
    const result = resolveStunTrigger(state);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
  });

  it("CC immunity suppresses second stun trigger within cooldown", () => {
    const base = createTestBattleState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
    };
    const result = resolveStunTrigger(state);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(result.enemyCC.cooldown).toBe(2);

    // Second trigger with cooldown active: clears stun but no extra skip.
    const state2 = {
      ...result,
      enemyCC: { ...result.enemyCC, cooldown: 1 },
      enemyStatuses: defaultEnemyStatusValues({ ...result.enemyStatuses, stun: 20 }),
    };
    const result2 = resolveStunTrigger(state2);
    expect(result2.enemyCC.stunSkipTurns).toBe(1); // unchanged
    expect(result2.enemyStatuses.stun).toBe(0);
  });

  it("grants block on stun with blockOnStun talent", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { ...createTestBattleState().talentEffects, blockOnStun: 3 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.block).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 3 });
  });

  it("grants forge on stun with forgeOnStun talent", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { ...createTestBattleState().talentEffects, forgeOnStun: 2 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.forge).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 2 });
  });

  it("triggers forge burn burst when forgeOnStun crosses threshold", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      playerStatuses: defaultPlayerStatusValues({ forge: 3 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: {
        ...createTestBattleState().talentEffects,
        forgeOnStun: 2,
        forgeBurnThreshold: 4,
        forgeBurnDamage: 8,
      },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.forge).toBe(5);
    expect(result.enemyStatuses.burn).toBe(8);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 8 });
  });

  it("does not trigger forge burn burst when forge stays below threshold", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      playerStatuses: defaultPlayerStatusValues({ forge: 1 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: {
        ...createTestBattleState().talentEffects,
        forgeOnStun: 2,
        forgeBurnThreshold: 4,
        forgeBurnDamage: 8,
      },
    });
    const result = resolveStunTrigger(state);
    expect(result.playerStatuses.forge).toBe(3);
    expect(result.enemyStatuses.burn).toBe(0);
  });

  it("strips enemy armor on stun with stunStripArmor talent", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0, freezeBonus: 0 }),
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { ...createTestBattleState().talentEffects, stunStripArmor: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("stunStripArmor does nothing when enemy has no armor", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: defaultEnemyMitigation({ armor: 0, forge: 0, freezeBonus: 0 }),
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { ...createTestBattleState().talentEffects, stunStripArmor: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("restores mana on stun with manaOnStun talent", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      mana: 2,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { ...createTestBattleState().talentEffects, manaOnStun: 1 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.mana).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 1 });
  });
});
