import { describe, expect, it } from "vitest";
import { resolveStunTrigger } from "@/lib/battle/status-stun-resolve";
import { applyCardEffects } from "@/lib/battle";
import { defaultTalentEffects } from "@/lib/battle";
import { addPlayerStatus, type CombatTextEvent } from "@/lib/battle/types";
import {
  makeCombatTexts as makeTexts,
  makeStateWithFailedRolls,
  makeTestCard,
  patchBattleState,
} from "../../fixtures/battle";
import { defaultGearEffects } from "@/lib/gear";
import {
  defaultEnemyMitigation,
  defaultCcState,
  defaultPlayerStatusValues,
  defaultEnemyStatusValues,
} from "../../fixtures/default-battle-state";

describe("resolveStunTrigger", () => {
  it("does nothing when stun is below threshold", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyStatuses: defaultEnemyStatusValues({ stun: 5 }),
    });
    const result = resolveStunTrigger(state);
    expect(result).toBe(state);
  });

  it("resets stun and skips turns when stun exceeds threshold", () => {
    const base = patchBattleState();
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
    const state = patchBattleState({
      enemyHealth: 0,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
    });
    const result = resolveStunTrigger(state);
    expect(result).toBe(state);
  });

  it("skips additional turns with stunDurationExtension", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { stunDurationExtension: 2 },
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
      effects: [{ kind: "damage" as const, damageType: "physical" as const, amount: 4 }],
    };
    const state = patchBattleState({
      deck: [card, card, card],
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { drawOnStun: 2 },
    });
    const result = resolveStunTrigger(state);
    expect(result.hand).toHaveLength(2);
    expect(result.deck).toHaveLength(1);
  });

  it("sets nextCardCostReduction with nextCardFreeOnStun", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { nextCardFreeOnStun: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.flags.nextCardCostReduction).toBe(99);
  });

  it("deals thunderstone damage and generates combat text", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      trinketEffects: { thunderstoneDamageOnStun: 5 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.enemyHealth).toBe(25);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "nature", amount: 5 });
  });

  it("thunderstone damage does not generate combat text when texts omitted", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      trinketEffects: { thunderstoneDamageOnStun: 5 },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyHealth).toBe(25);
  });

  it("applies lucky clover gold from thunderstone even when texts are omitted", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      trinketEffects: {
        thunderstoneDamageOnStun: 5,
        luckyCloverGoldChance: 100,
      },
      rng: () => 0,
    });

    const result = resolveStunTrigger(state);

    expect(result.gold).toBe(5);
  });

  it("uses stunThresholdReduction to lower threshold", () => {
    const base = patchBattleState();
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
    const base = patchBattleState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
    };
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
    const base = patchBattleState();
    const state = {
      ...base,
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ cooldown: 1 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { ...base.talentEffects, blockOnStun: 3 },
      gearEffects: { ...defaultGearEffects, damageOnStunPhysical: 7 },
    };
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(0);
    expect(result.enemyHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(0);
    expect(texts).not.toContainEqual({ target: "player", kind: "status", stat: "block", amount: 3 });
  });

  it("grants block on stun with blockOnStun talent", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { blockOnStun: 3 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.block).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 3 });
  });

  it("grants forge on stun with forgeOnStun talent", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { forgeOnStun: 2 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.forge).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 2 });
  });

  it("triggers forge burn burst when forgeOnStun crosses threshold", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      playerStatuses: defaultPlayerStatusValues({ forge: 3 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: {
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
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      playerStatuses: defaultPlayerStatusValues({ forge: 1 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: {
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
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: defaultEnemyMitigation({ armor: 5, forge: 0 }),
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { stunStripArmor: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("stunStripArmor does nothing when enemy has no armor", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyMitigation: defaultEnemyMitigation({ armor: 0, forge: 0 }),
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { stunStripArmor: true },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("restores mana on stun with manaOnStun talent", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      mana: 2,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      talentEffects: { manaOnStun: 1 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.mana).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 1 });
  });

  it("deals physical damage on stun with gear damageOnStunPhysical", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      gearEffects: { ...defaultGearEffects, damageOnStunPhysical: 7 },
    });
    const result = resolveStunTrigger(state);
    expect(result.enemyHealth).toBe(23);
  });

  it("deals physical damage on stun with gear damageOnStunPhysical and produces combat text", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      gearEffects: { ...defaultGearEffects, damageOnStunPhysical: 7 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.enemyHealth).toBe(23);
    expect(texts).toContainEqual({ target: "enemy", kind: "damage", stat: "physical", amount: 7 });
  });

  it("applies gear forgeOnStun with combat text", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      gearEffects: { ...defaultGearEffects, forgeOnStun: 4 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("applies gear blockOnStun with combat text", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      gearEffects: { ...defaultGearEffects, blockOnStun: 5 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);
    expect(result.playerStatuses.block).toBe(5);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 5 });
  });

  it("applies gear manaOnStun with combat text", () => {
    const state = patchBattleState({
      enemyHealth: 30,
      enemyMaxHealth: 30,
      mana: 3,
      maxMana: 4,
      enemyCC: defaultCcState({ stunSkipTurns: 0 }),
      enemyStatuses: defaultEnemyStatusValues({ stun: 20 }),
      gearEffects: { ...defaultGearEffects, manaOnStun: 2 },
    });
    const texts = makeTexts();
    const result = resolveStunTrigger(state, texts);

    expect(result.mana).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "mana", amount: 1 });
  });
});

describe("resolveStunTrigger via applyCardEffects", () => {
  it("resolves and triggers stun when stun is added from burn damage riders", () => {
    const talentEffects = { ...defaultTalentEffects, burnStunChance: 100 };
    const card = makeTestCard({
      id: "fireball",
      effects: [{ kind: "damage", damageType: "burn", amount: 12 }],
    });
    const state = makeStateWithFailedRolls({
      mana: 10,
      enemyHealth: 20,
      enemyMaxHealth: 20,
      talentEffects,
      hand: [card],
      rng: () => 0.5,
    });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
    expect(result.enemyCC.cooldown).toBe(0);
    expect(texts).toContainEqual({ target: "enemy", kind: "notice", stat: "stun", text: "Stunned" });
  });

  it("resolves and triggers stun when stun status is applied directly via enemy-status effect", () => {
    const card = makeTestCard({
      id: "apply-stun",
      effects: [{ kind: "enemy-status", status: "stun", amount: 11 }],
    });
    const state = makeStateWithFailedRolls({ mana: 10, enemyHealth: 20, enemyMaxHealth: 20, hand: [card] });
    const texts: CombatTextEvent[] = [];
    const result = applyCardEffects(state, card, texts);
    expect(result.enemyStatuses.stun).toBe(0);
    expect(result.enemyCC.stunSkipTurns).toBe(1);
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
      enemyStatuses: defaultEnemyStatusValues({ freeze: 6 }),
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
      playerStatuses: { ...patchBattleState().playerStatuses, block: 2 },
      gearEffects: { ...defaultGearEffects, flatBlockGained: 3 },
    });
    const next = addPlayerStatus(state, "block", 4);
    expect(next.playerStatuses.block).toBe(9);
  });

  it("applies gear blockOnStun when enemy is stunned", () => {
    const state = patchBattleState({
      enemyHealth: 20,
      enemyMaxHealth: 30,
      enemyStatuses: { ...patchBattleState().enemyStatuses, stun: 20 },
      gearEffects: { ...defaultGearEffects, blockOnStun: 2, flatBlockGained: 1 },
    });
    const texts: Parameters<typeof resolveStunTrigger>[1] = [];
    const next = resolveStunTrigger(state, texts);
    expect(next.playerStatuses.block).toBeGreaterThanOrEqual(3);
    const blockText = texts.find((t) => t.stat === "block");
    expect((blockText as { amount: number } | undefined)?.amount).toBe(3);
  });

  it("awards healOnKill when stun proc damage kills the enemy", () => {
    const state = patchBattleState({
      enemyHealth: 3,
      enemyMaxHealth: 30,
      playerHealth: 10,
      playerMaxHealth: 20,
      enemyStatuses: { ...patchBattleState().enemyStatuses, stun: 20 },
      gearEffects: { ...defaultGearEffects, damageOnStunPhysical: 5, healOnKill: 4 },
    });
    const texts: Parameters<typeof resolveStunTrigger>[1] = [];
    const next = resolveStunTrigger(state, texts);
    expect(next.enemyHealth).toBe(0);
    expect(next.playerHealth).toBe(14);
    expect(texts.some((t) => t.kind === "heal" && t.amount === 4)).toBe(true);
  });
});
