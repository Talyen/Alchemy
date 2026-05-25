import { describe, expect, it, vi } from "vitest";
import {
  getEnemyDamageMultiplier,
  resolveStunTrigger,
  applyDamageStatuses,
  applyPlayerStatusEffect,
  removeHarmfulPlayerStatuses,
} from "@/lib/battle/status-effects";
import type { CombatTextEvent } from "@/lib/battle/types";
import { createTestBattleState } from "./test-state";

vi.spyOn(Math, "random").mockReturnValue(0.99);

function makeTexts(): CombatTextEvent[] {
  return [];
}

// ─── resolveStunTrigger ───

describe("resolveStunTrigger", () => {
  it("does nothing when stun is below threshold", () => {
    const state = createTestBattleState({ enemyHealth: 30, enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 5 } });
    const result = resolveStunTrigger(state);
    expect(result).toBe(state);
  });

  it("resets stun and skips turns when stun exceeds threshold", () => {
    const base = createTestBattleState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...base.enemyStatuses, stun: 20 },
    };
    const result = resolveStunTrigger(state);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyStunSkipTurns).toBe(1);
  });

  it("does nothing when enemy is dead", () => {
    const state = createTestBattleState({
      enemyHealth: 0,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
    });
    const result = resolveStunTrigger(state);
    expect(result).toBe(state);
  });

  it("skips additional turns with stunDurationExtension", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
      talentEffects: { ...createTestBattleState().talentEffects, stunDurationExtension: 2 },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyStunSkipTurns).toBe(3);
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
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
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
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
      talentEffects: { ...createTestBattleState().talentEffects, nextCardFreeOnStun: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.flags.nextCardCostReduction).toBe(99);
  });

  it("deals thunderstone damage and generates combat text", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
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
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
      trinketEffects: { ...createTestBattleState().trinketEffects, thunderstoneDamageOnStun: 5 },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyHealth).toBe(25);
  });

  it("applies lucky clover gold from thunderstone even when texts are omitted", () => {
    vi.spyOn(Math, "random").mockReturnValueOnce(0);
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
      trinketEffects: {
        ...createTestBattleState().trinketEffects,
        thunderstoneDamageOnStun: 5,
        luckyCloverGoldChance: 100,
      },
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
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...base.enemyStatuses, stun: 10 },
      talentEffects: { ...base.talentEffects, stunThresholdReduction: 0.2 },
    };
    const result = resolveStunTrigger(state);
    expect(result.enemyStunSkipTurns).toBe(1);
  });

  it("CC immunity suppresses second stun trigger within cooldown", () => {
    const base = createTestBattleState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyCCCooldown: 0,
      enemyStatuses: { ...base.enemyStatuses, stun: 20 },
    };
    const result = resolveStunTrigger(state);
    expect(result.enemyStunSkipTurns).toBe(1);
    expect(result.enemyCCCooldown).toBe(2);

    // Second trigger with cooldown active: clears stun but no extra skip.
    const state2 = { ...result, enemyCCCooldown: 1, enemyStatuses: { ...result.enemyStatuses, stun: 20 } };
    const result2 = resolveStunTrigger(state2);
    expect(result2.enemyStunSkipTurns).toBe(1); // unchanged
    expect(result2.enemyStatuses.stun).toBe(0);
  });

  it("grants block on stun with blockOnStun talent", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
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
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
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
      enemyStunSkipTurns: 0,
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 3 },
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
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
      enemyStunSkipTurns: 0,
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 1 },
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
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
      enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0 },
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
      talentEffects: { ...createTestBattleState().talentEffects, stunStripArmor: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("stunStripArmor does nothing when enemy has no armor", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: { armor: 0, forge: 0, freezeBonus: 0 },
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
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
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, stun: 20 },
      talentEffects: { ...createTestBattleState().talentEffects, manaOnStun: 1 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.mana).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 1 });
  });
});

// ─── getEnemyDamageMultiplier ───

describe("getEnemyDamageMultiplier", () => {
  it("returns 1 when no multipliers apply", () => {
    const state = createTestBattleState();
    const result = getEnemyDamageMultiplier(state, "physical");
    expect(result).toBe(1);
  });

  it("returns TRAIT_DAMAGE_WEAKNESS when stunDoubleDamage is active and enemy is stunned", () => {
    const state = createTestBattleState({ enemyStunSkipTurns: 1, talentEffects: { ...createTestBattleState().talentEffects, stunDoubleDamage: true } });
    const result = getEnemyDamageMultiplier(state, "physical");
    expect(result).toBe(2);
  });

  it("returns TRAIT_DAMAGE_WEAKNESS when freezeDoubleDamage is active and enemy is frozen", () => {
    const state = createTestBattleState({ enemyFreezeSkipTurns: 1, talentEffects: { ...createTestBattleState().talentEffects, freezeDoubleDamage: true } });
    const result = getEnemyDamageMultiplier(state, "physical");
    expect(result).toBe(2);
  });

  it("returns 4x when both stun and freeze double damage are active", () => {
    const state = createTestBattleState({
      enemyStunSkipTurns: 1,
      enemyFreezeSkipTurns: 1,
      talentEffects: { ...createTestBattleState().talentEffects, stunDoubleDamage: true, freezeDoubleDamage: true },
    });
    const result = getEnemyDamageMultiplier(state, "physical");
    expect(result).toBe(4);
  });

  it("trait weakness takes priority over stun/freeze multipliers", () => {
    const state = createTestBattleState({
      enemyStunSkipTurns: 1,
      enemyFreezeSkipTurns: 1,
      talentEffects: { ...createTestBattleState().talentEffects, stunDoubleDamage: true, freezeDoubleDamage: true },
      currentEnemy: {
        id: "brittle-skeleton",
        title: "Brittle Skeleton",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "brittle-bones", title: "Brittle Bones", description: "Weak to Holy" }],
        attackEffects: [],
      },
    });
    const result = getEnemyDamageMultiplier(state, "holy");
    expect(result).toBe(2); // trait weakness, not stun×freeze
  });
});

// ─── applyDamageStatuses ───

describe("applyDamageStatuses", () => {
  it("burn adds to enemy burn stack", () => {
    const state = createTestBattleState();
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 7, []);
    expect(result.enemyStatuses.burn).toBe(7);
  });

  it("burn removes enemy armor with burnRemovesEnemyArmor", () => {
    const state = createTestBattleState({
      enemyMitigation: { armor: 5, forge: 0, freezeBonus: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, burnRemovesEnemyArmor: true },
    });
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.enemyMitigation.armor).toBe(2);
  });

  it("burn removes armor but not below 0", () => {
    const state = createTestBattleState({
      enemyMitigation: { armor: 2, forge: 0, freezeBonus: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, burnRemovesEnemyArmor: true },
    });
    const effect = { kind: "damage" as const, damageType: "burn" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("poison adds to enemy poison stack", () => {
    const state = createTestBattleState();
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 4, []);
    expect(result.enemyStatuses.poison).toBe(4);
  });

  it("poison grants goldOnFirstPoison on first hit", () => {
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, goldOnFirstPoison: 8 },
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 3, texts);
    expect(result.gold).toBe(8);
    expect(result.flags.goldOnFirstPoisonThisCombat).toBe(true);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 8 });
  });

  it("poison grants goldOnFirstPoison only once", () => {
    const state = createTestBattleState({
      gold: 10,
      talentEffects: { ...createTestBattleState().talentEffects, goldOnFirstPoison: 8 },
      flags: { ...createTestBattleState().flags, goldOnFirstPoisonThisCombat: true },
    });
    const effect = { kind: "damage" as const, damageType: "poison" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.gold).toBe(10);
  });

  it("bleed adds 2x status to bleed stack", () => {
    const state = createTestBattleState();
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5 };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.enemyStatuses.bleed).toBe(10);
  });

  it("bleed with lifesteal adds pending bleed leech healing", () => {
    const state = createTestBattleState();
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5, lifesteal: true };
    const result = applyDamageStatuses(state, effect, 5, []);
    expect(result.pendingBleedLeechHealing).toBe(10);
  });

  it("cutpurseGoldOnBleed grants gold on bleed", () => {
    const state = createTestBattleState({
      trinketEffects: { ...createTestBattleState().trinketEffects, cutpurseGoldOnBleed: 2 },
    });
    const effect = { kind: "damage" as const, damageType: "bleed" as const, amount: 5 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 5, texts);
    expect(result.gold).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "gold", amount: 2 });
  });

  it("stun adds to stun stack and triggers resolveStunTrigger", () => {
    const base = createTestBattleState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStunSkipTurns: 0,
      enemyStatuses: { ...base.enemyStatuses, stun: 15 },
    };
    const effect = { kind: "damage" as const, damageType: "stun" as const, amount: 5 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 5, texts);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyStunSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("freeze adds to freeze stack", () => {
    const state = createTestBattleState();
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 3 };
    const result = applyDamageStatuses(state, effect, 3, []);
    expect(result.enemyStatuses.freeze).toBe(3);
  });

  it("freeze triggers skip when above threshold", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, freeze: 15 },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyStatuses.freeze).toBe(0);
    expect(result.enemyFreezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" });
  });

  it("freeze skip adds freezeDurationExtension", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, freeze: 15 },
      trinketEffects: { ...createTestBattleState().trinketEffects, freezeDurationExtension: 2 },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const result = applyDamageStatuses(state, effect, 10, []);
    expect(result.enemyFreezeSkipTurns).toBe(3);
  });

  it("freeze triggers frozenHeartDamage on skip", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, freeze: 15 },
      trinketEffects: { ...createTestBattleState().trinketEffects, frozenHeartDamage: 6 },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyHealth).toBe(24);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 6 });
  });

  it("freeze CC immunity suppresses second freeze trigger within cooldown", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCCCooldown: 0,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, freeze: 15 },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const texts = makeTexts();
    const result = applyDamageStatuses(state, effect, 10, texts);
    expect(result.enemyFreezeSkipTurns).toBe(1);
    expect(result.enemyCCCooldown).toBe(2);

    // Second trigger with cooldown: clear freeze but no extra skip.
    const state2 = { ...result, enemyCCCooldown: 1, enemyStatuses: { ...result.enemyStatuses, freeze: 15 } };
    const result2 = applyDamageStatuses(state2, effect, 10, []);
    expect(result2.enemyFreezeSkipTurns).toBe(1); // unchanged
    expect(result2.enemyStatuses.freeze).toBe(0);
  });

  it("freeze does not trigger on glacial-shell enemies", () => {
    const state = createTestBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { ...createTestBattleState().enemyStatuses, freeze: 15 },
      currentEnemy: {
        id: "ice-golem",
        title: "Ice Golem",
        subtitle: "",
        descriptionLines: [""],
        art: "",
        enemyType: "normal",
        traits: [{ id: "glacial-shell", title: "Glacial Shell", description: "Freeze immune" }],
        attackEffects: [],
      },
    });
    const effect = { kind: "damage" as const, damageType: "freeze" as const, amount: 10 };
    const result = applyDamageStatuses(state, effect, 10, []);
    expect(result.enemyStatuses.freeze).toBe(25);
    expect(result.enemyFreezeSkipTurns).toBe(0);
  });
});

// ─── removeHarmfulPlayerStatuses ───

describe("removeHarmfulPlayerStatuses", () => {
  it("removes statuses in priority order", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 5, poison: 3, bleed: 2 },
    });
    const result = removeHarmfulPlayerStatuses(state, 2);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.bleed).toBe(2);
  });

  it("does not heal with sinEater trinket when not owned", () => {
    const state = createTestBattleState({
      playerHealth: 20,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 5 },
    });
    const result = removeHarmfulPlayerStatuses(state, 1);
    expect(result.playerHealth).toBe(20);
  });

  it("heals with sinEater trinket on remove", () => {
    const state = createTestBattleState({
      playerHealth: 20,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 5, poison: 3 },
      trinketEffects: { ...createTestBattleState().trinketEffects, sinEaterHealOnHarmfulStatusRemove: 4 },
    });
    const texts = makeTexts();
    const result = removeHarmfulPlayerStatuses(state, 2, texts);
    // sinEaterHealOnHarmfulStatusRemove heals once for the batch, not per status
    expect(result.playerHealth).toBe(24);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 4 });
  });

  it("does nothing when no statuses to remove", () => {
    const state = createTestBattleState({
      playerHealth: 20,
      trinketEffects: { ...createTestBattleState().trinketEffects, sinEaterHealOnHarmfulStatusRemove: 4 },
    });
    const result = removeHarmfulPlayerStatuses(state, 1);
    expect(result.playerHealth).toBe(20);
  });

  it("heals and emits overheal block text when status cleanse heals above max health", () => {
    const state = createTestBattleState({
      playerHealth: 28,
      playerMaxHealth: 30,
      playerStatuses: { ...createTestBattleState().playerStatuses, burn: 5, block: 2 },
      talentEffects: {
        ...createTestBattleState().talentEffects,
        healOnStatusCleanse: 10,
        overhealToBlockRatio: 0.5,
      },
    });
    const texts = makeTexts();
    // cleanses burn, triggers healOnStatusCleanse(10) -> overheal = 8 -> block gained = round(8 * 0.5) = 4.
    const result = removeHarmfulPlayerStatuses(state, 1, texts);
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(6);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 10 });
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 4 });
  });
});

// ─── applyPlayerStatusEffect ───

describe("applyPlayerStatusEffect", () => {
  it("adds the status amount to player", () => {
    const state = createTestBattleState();
    const effect = { kind: "player-status" as const, status: "block" as const, amount: 5 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("doubles armor when player is below half health and armorDoubledBelowHalfHealth is active", () => {
    const state = createTestBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...createTestBattleState().talentEffects, armorDoubledBelowHalfHealth: true },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(8);
  });

  it("doubles armor on first armor card when firstArmorCardDoubled is active", () => {
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, firstArmorCardDoubled: true },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(8);
    expect(result.flags.firstArmorCardDoubledUsed).toBe(true);
  });

  it("does not double armor on second armor card when flag is used", () => {
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, firstArmorCardDoubled: true },
      flags: { ...createTestBattleState().flags, firstArmorCardDoubledUsed: true },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(4);
  });

  it("grants block when armor crosses armorBlockThreshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, armor: 3 },
      talentEffects: { ...createTestBattleState().talentEffects, armorBlockThreshold: 5, armorBlockAmount: 3 },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.armor).toBe(6);
    expect(result.playerStatuses.block).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 3 });
  });

  it("does not grant block when armor does not cross threshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, armor: 1 },
      talentEffects: { ...createTestBattleState().talentEffects, armorBlockThreshold: 5, armorBlockAmount: 3 },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(4);
    expect(result.playerStatuses.block).toBe(0);
  });

  it("adds forge amount to block when forgeToBlock is active", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 3 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeToBlock: true },
    });
    const effect = { kind: "player-status" as const, status: "block" as const, amount: 5 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.block).toBe(8);
  });

  it("applies forge burn burst when forge crosses threshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 3 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeBurnThreshold: 5, forgeBurnDamage: 4 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(6);
    expect(result.enemyStatuses.burn).toBe(4);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "burn", amount: 4 });
  });

  it("does not apply forge burn burst when below threshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 1 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeBurnThreshold: 5, forgeBurnDamage: 4 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(4);
    expect(result.enemyStatuses.burn).toBe(0);
  });

  it("flatForgeGained increases forge from card effects", () => {
    const state = createTestBattleState({
      talentEffects: { ...createTestBattleState().talentEffects, flatForgeGained: 1 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("forgeDoubledBelowHalfHealth doubles forge gain when health is low", () => {
    const state = createTestBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...createTestBattleState().talentEffects, forgeDoubledBelowHalfHealth: true },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("forgeDoubledBelowHalfHealth does not double when health is above 50%", () => {
    const state = createTestBattleState({
      playerHealth: 20,
      playerMaxHealth: 30,
      talentEffects: { ...createTestBattleState().talentEffects, forgeDoubledBelowHalfHealth: true },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(2);
  });

  it("strips enemy armor when forge crosses forgeStripArmorThreshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 5 },
      enemyMitigation: { armor: 4, forge: 0, freezeBonus: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeStripArmorThreshold: 6 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("does not strip enemy armor when forge does not cross threshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 3 },
      enemyMitigation: { armor: 4, forge: 0, freezeBonus: 0 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeStripArmorThreshold: 6 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(5);
    expect(result.enemyMitigation.armor).toBe(4);
  });

  it("grants block when forge crosses forgeBlockThreshold", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 5 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeBlockThreshold: 6, forgeBlockAmount: 10 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.playerStatuses.block).toBe(10);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 10 });
  });

  it("forgeBlockBurst respects forgeToBlock synergy", () => {
    const state = createTestBattleState({
      playerStatuses: { ...createTestBattleState().playerStatuses, forge: 5 },
      talentEffects: { ...createTestBattleState().talentEffects, forgeToBlock: true, forgeBlockThreshold: 6, forgeBlockAmount: 10 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.playerStatuses.block).toBe(17);
  });

  it("flatForgeGained and forgeDoubledBelowHalfHealth stack together", () => {
    const state = createTestBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: { ...createTestBattleState().talentEffects, flatForgeGained: 1, forgeDoubledBelowHalfHealth: true },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(6);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 6 });
  });
});
