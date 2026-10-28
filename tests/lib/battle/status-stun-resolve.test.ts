import { makeDamageCard } from "../../fixtures/cards";
import { describe, expect, it } from "vitest";
import { applyScaledLeechHealing, resolveStunTrigger } from "@/lib/battle/stun-leech-resolution";
import { applyCardEffects, defaultTalentEffects } from "@/lib/battle";
import type { CombatTextEvent } from "@/lib/battle/types";
import { addPlayerStatus } from "@/lib/battle/status-state";
import {
  makeCombatTexts as makeTexts,
  makeStateWithFailedRolls,
  makeTestCard,
  patchBattleState,
  type BattleStatePatch,
} from "../../fixtures/battle";
import { defaultEnemyStatusValues } from "../../fixtures/default-battle-state";

function stunnedEnemy(patch: BattleStatePatch = {}) {
  return patchBattleState({ enemyStatuses: { stun: 20 }, ...patch });
}

describe("resolveStunTrigger", () => {
  it("does nothing when stun is below threshold", () => {
    const state = stunnedEnemy({
      enemyStatuses: { stun: 5 },
    });
    const result = resolveStunTrigger(state);
    expect(result).toBe(state);
  });

  it("resets stun and skips turns when stun exceeds threshold", () => {
    const state = stunnedEnemy();
    const result = resolveStunTrigger(state);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
  });

  it("does nothing when enemy is dead", () => {
    const state = stunnedEnemy({
      enemyHealth: 0,
    });
    const result = resolveStunTrigger(state);
    expect(result).toBe(state);
  });

  it("skips additional turns with stunDurationExtension", () => {
    const state = stunnedEnemy({
      talentEffects: { stunDurationExtension: 2 },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyCC.stunSkipTurns).toBe(3);
  });

  it("draws cards with drawOnStun", () => {
    const card = makeTestCard({
      id: "strike",
      title: "Strike",
      effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 4 }],
    });
    const state = stunnedEnemy({
      deck: [card, card, card],
      talentEffects: { drawOnStun: 2 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "draw", amount: 2 });
  });

  it("sets nextCardCostReduction with nextCardFreeOnStun", () => {
    const state = stunnedEnemy({
      talentEffects: { nextCardFreeOnStun: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.flags.nextCardCostReduction).toBe(99);
  });

  it("deals thunderstone damage and generates combat text", () => {
    const state = stunnedEnemy({
      trinketEffects: { thunderstoneDamageOnStun: 5 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.enemyHealth).toBe(25);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "nature", amount: 5 });
  });

  it("applies lucky clover gold from thunderstone even when texts are omitted", () => {
    const state = stunnedEnemy({
      trinketEffects: {
        thunderstoneDamageOnStun: 5,
        luckyCloverGoldChance: 100,
      },
      rng: () => 0,
    });

    const result = resolveStunTrigger(state);

    expect(result.gold).toBe(5);
  });

  it("never drops the stun threshold below the shared 10% floor", () => {
    const belowFloor = stunnedEnemy({
      enemyStatuses: { stun: 2 },
      talentEffects: { stunThresholdReduction: 0.45 },
    });
    expect(resolveStunTrigger(belowFloor).enemyCC.stunSkipTurns).toBe(0);

    const atFloor = { ...belowFloor, enemyStatuses: { ...belowFloor.enemyStatuses, stun: 3 } };
    expect(resolveStunTrigger(atFloor).enemyCC.stunSkipTurns).toBe(1);
  });

  it("uses stunThresholdReduction to lower threshold", () => {
    const state = stunnedEnemy({
      enemyStatuses: { stun: 10 },
      talentEffects: { stunThresholdReduction: 0.2 },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
  });

  it("CC immunity suppresses second stun trigger within cooldown", () => {
    const state = stunnedEnemy();
    const result = resolveStunTrigger(state);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(result.enemyCC.cooldown).toBe(0);

    const state2 = {
      ...result,
      enemyCC: { ...result.enemyCC, stunSkipTurns: 0, cooldown: 2 },
      enemyStatuses: defaultEnemyStatusValues({ ...result.enemyStatuses, stun: 20 }),
    };
    const result2 = resolveStunTrigger(state2);
    expect(result2.enemyCC.stunSkipTurns).toBe(0);
    expect(result2.enemyStatuses.stun).toBe(0);
  });

  it("withholds stun rewards when CC immunity clears the stack", () => {
    const state = stunnedEnemy({
      enemyCC: { cooldown: 1 },
      talentEffects: { blockOnStun: 3 },
      gearEffects: { damageOnStunPhysical: 7 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(0);
    expect(result.enemyHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(0);
    expect(texts).not.toContainEqual({ target: "player", kind: "status", stat: "block", amount: 3 });
  });

  it("strips enemy armor on stun with stunStripArmor talent", () => {
    const state = stunnedEnemy({
      enemyMitigation: { armor: 5, forge: 0 },
      talentEffects: { stunStripArmor: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("restores mana on stun with manaOnStun talent", () => {
    const state = stunnedEnemy({
      mana: 0,
      talentEffects: { manaOnStun: 1 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.mana).toBe(1);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 1 });
  });

  it("deals physical damage on stun with gear damageOnStunPhysical and produces combat text", () => {
    const state = stunnedEnemy({
      gearEffects: { damageOnStunPhysical: 7 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.enemyHealth).toBe(23);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 7 });
  });

  it("combines talent and gear Forge on Stun with combat text", () => {
    const state = stunnedEnemy({
      gearEffects: { forgeOnStunChances: [100, 100, 100, 100] },
      talentEffects: { forgeOnStun: 1, forgeOnStunChance: 100 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.forge).toBe(5);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 5 });
  });

  it("combines talent and gear Block on Stun with combat text", () => {
    const state = stunnedEnemy({
      gearEffects: { blockOnStun: 5 },
      talentEffects: { blockOnStun: 2 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.block).toBe(7);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 7 });
  });

  it("applies gear manaOnStun with combat text", () => {
    const state = stunnedEnemy({
      mana: 0,
      maxMana: 4,
      gearEffects: { manaOnStun: 2 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);

    expect(result.mana).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 2 });
  });
});

describe("resolveStunTrigger via applyCardEffects", () => {
  it("resolves and triggers stun when stun is added from burn damage riders", () => {
    const talentEffects = { ...defaultTalentEffects, burnStunChance: 100 };
    const card = makeDamageCard("burn", 12, { id: "fireball" });
    const state = makeStateWithFailedRolls({
      mana: 10,
      talentEffects,
      hand: [card],
      rng: () => 0.5,
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyHealth).toBe(6);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(result.enemyCC.cooldown).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("resolves and triggers freeze when freeze status is doubled via multiply-enemy-status effect", () => {
    const card = makeTestCard({
      id: "double-freeze",
      effects: [{ kind: "multiply-enemy-status", status: "freeze", factor: 2 }],
    });
    const state = makeStateWithFailedRolls({
      mana: 10,
      enemyHealth: 20,
      enemyMaxHealth: 20,
      enemyStatuses: { freeze: 6 },
      hand: [card],
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.freeze).toBe(0);
    expect(result.enemyCC.freezeSkipTurns).toBe(1);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "freeze", text: "Frozen" });
  });
});

describe("gear stun integration", () => {
  it("adds flatBlockGained when gaining block via addPlayerStatus", () => {
    const state = patchBattleState({
      playerStatuses: { block: 2 },
      gearEffects: { flatBlockGained: 3 },
    });
    const next = addPlayerStatus(state, "block", 4);
    expect(next.playerStatuses.block).toBe(9);
  });

  it("applies gear blockOnStun when enemy is stunned", () => {
    const state = stunnedEnemy({
      enemyHealth: 20,
      gearEffects: { blockOnStun: 2, flatBlockGained: 1 },
    });
    const texts: Parameters<typeof resolveStunTrigger>[1] = [];
    const next = resolveStunTrigger(state, texts);
    expect(next.playerStatuses.block).toBeGreaterThanOrEqual(3);
    const blockText = texts.find((t) => t.stat === "block");
    expect((blockText as { amount: number } | undefined)?.amount).toBe(3);
  });

  it("awards healOnKill when stun proc damage kills the enemy", () => {
    const state = stunnedEnemy({
      enemyHealth: 3,
      playerHealth: 10,
      playerMaxHealth: 20,
      gearEffects: { damageOnStunPhysical: 5, healOnKill: 4 },
    });
    const texts: Parameters<typeof resolveStunTrigger>[1] = [];
    const next = resolveStunTrigger(state, texts);
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(14);
    expect(texts.some((t) => t.kind === "heal" && t.amount === 4)).toBe(true);
  });

  it("Lingering Bell cannot extend an active Stun or pay Stun rewards again after Health falls", () => {
    const stunned = resolveStunTrigger(
      patchBattleState({
        enemyHealth: 40,
        enemyMaxHealth: 40,
        enemyStatuses: { stun: 20 },
        gearEffects: { retainStunBuildup: 1 },
        talentEffects: { manaOnStun: 1 },
        mana: 0,
      }),
    );
    const weakened = { ...stunned, enemyHealth: 8 };
    const result = resolveStunTrigger(weakened);
    expect(result.enemyCC).toEqual(stunned.enemyCC);
    expect(result.enemyStatuses.stun).toBe(5);
    expect(result.mana).toBe(stunned.mana);
  });

  it("Leech-triggered Stun pays Thunderstone's Rootmender healing and its Leech riders once", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 40,
      enemyHealth: 40,
      enemyMaxHealth: 40,
      mana: 0,
      maxMana: 3,
      enemyStatuses: { stun: 20, poison: 1 },
      gearEffects: { natureLeechVsPoisoned: 1, stunOnLeechBelowHalfHealth: 2 },
      trinketEffects: { thunderstoneDamageOnStun: 6 },
      talentEffects: { manaOnLeechChance: 100 },
    });
    const next = applyScaledLeechHealing(state, 2, []);
    expect(next.enemyHealth).toBe(30);
    expect(next.playerHealth).toBe(15);
    expect(next.mana).toBe(2);
    expect(next.enemyCC.stunSkipTurns).toBe(1);
  });

  it("Rootmender grants Leech for Thunderstone damage against a Poisoned enemy", () => {
    const state = patchBattleState({
      playerHealth: 10,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyStatuses: { stun: 30, poison: 1 },
      trinketEffects: { thunderstoneDamageOnStun: 6 },
      gearEffects: { natureLeechVsPoisoned: 1 },
    });
    const next = resolveStunTrigger(state, []);
    expect(next.enemyHealth).toBe(24);
    expect(next.playerHealth).toBe(13);
  });

  it("Thunderstone cannot reward damage after Stun gear kills the enemy", () => {
    const state = patchBattleState({
      enemyHealth: 5,
      enemyMaxHealth: 100,
      enemyStatuses: { stun: 100 },
      mana: 0,
      gearEffects: { damageOnStunPhysical: 5, manaOnNatureDamageChance: 100 },
      trinketEffects: { thunderstoneDamageOnStun: 6 },
    });
    const result = resolveStunTrigger(state, []);
    expect(result.enemyHealth).toBe(0);
    expect(result.mana).toBe(0);
  });

  it("Stunning proc damage spends enemy Block without granting rewards for absorbed damage and respects Armor", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { block: 10, armor: 3 },
      enemyStatuses: { stun: 100 },
      gearEffects: { damageOnStunPhysical: 6 },
      talentEffects: { armorOnPhysicalDamageChance: 100 },
      rng: () => 0.99,
    });
    const result = resolveStunTrigger(state, []);
    expect(result.enemyHealth).toBe(100);
    expect(result.enemyMitigation).toMatchObject({ block: 4, armor: 3 });
    expect(result.playerStatuses.armor).toBe(0);

    const withLessBlock = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { block: 1, armor: 3 },
      enemyStatuses: { stun: 100 },
      gearEffects: { damageOnStunPhysical: 6 },
    });
    const afterArmor = resolveStunTrigger(withLessBlock, []);
    expect(afterArmor.enemyHealth).toBe(98);
    expect(afterArmor.enemyMitigation).toMatchObject({ block: 0, armor: 2 });
  });

  it("Thunderstone decays Armor on positive damage without Armor mitigation", () => {
    const state = patchBattleState({
      enemyHealth: 100,
      enemyMaxHealth: 100,
      enemyMitigation: { armor: 3 },
      enemyStatuses: { stun: 100 },
      trinketEffects: { thunderstoneDamageOnStun: 6 },
      rng: () => 0.99,
    });
    const result = resolveStunTrigger(state, []);
    expect(result.enemyHealth).toBe(94);
    expect(result.enemyMitigation.armor).toBe(2);
  });
});
