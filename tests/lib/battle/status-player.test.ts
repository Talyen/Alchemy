import { describe, expect, it } from "vitest";
import {
  addForgeToPlayer,
  applyPlayerDamageStatuses,
  applyPlayerStatusEffect,
  removeHarmfulPlayerStatuses,
} from "@/lib/battle/status-player";
import { makeCombatTexts as makeTexts, makeTestBattleState, patchBattleState } from "../../fixtures/battle";
import {
  defaultEnemyMitigation,
  defaultPlayerStatusValues,
  defaultTalentEffects,
  defaultTrinketManifest,
  defaultCombatFlags,
} from "../../fixtures/default-battle-state";

describe("applyPlayerStatusEffect — armor talent thresholds", () => {
  it("cleanses harmful statuses when armor crosses armorCleanseThreshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ burn: 4, armor: 1 }),
      talentEffects: { ...defaultTalentEffects, armorCleanseThreshold: 5 },
    });
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, { kind: "player-status", status: "armor", amount: 5 }, texts);
    expect(result.playerStatuses.armor).toBe(6);
    expect(result.playerStatuses.burn).toBe(0);
  });

  it("does not cleanse when armor stays below the threshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ burn: 4, armor: 0 }),
      talentEffects: { ...defaultTalentEffects, armorCleanseThreshold: 5 },
    });
    const result = applyPlayerStatusEffect(state, { kind: "player-status", status: "armor", amount: 2 }, makeTexts());
    expect(result.playerStatuses.burn).toBe(4);
  });
});

describe("removeHarmfulPlayerStatuses", () => {
  it("removes statuses in priority order", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ burn: 5, poison: 3, bleed: 2 }),
    });
    const result = removeHarmfulPlayerStatuses(state, 2);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.bleed).toBe(2);
  });

  it("does not heal with sinEater boon when not owned", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerStatuses: defaultPlayerStatusValues({ burn: 5 }),
    });
    const result = removeHarmfulPlayerStatuses(state, 1);
    expect(result.playerHealth).toBe(20);
  });

  it("heals with sinEater boon on remove", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerStatuses: defaultPlayerStatusValues({ burn: 5, poison: 3 }),
      trinketEffects: defaultTrinketManifest({ sinEaterHealOnHarmfulStatusRemove: 4 }),
    });
    const texts = makeTexts();
    const result = removeHarmfulPlayerStatuses(state, 2, texts);

    expect(result.playerHealth).toBe(24);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 4 });
  });

  it("does nothing when no statuses to remove", () => {
    const state = patchBattleState({
      playerHealth: 20,
      trinketEffects: defaultTrinketManifest({ sinEaterHealOnHarmfulStatusRemove: 4 }),
    });
    const result = removeHarmfulPlayerStatuses(state, 1);
    expect(result.playerHealth).toBe(20);
  });

  it("heals and emits overheal block text when status cleanse heals above max health", () => {
    const state = patchBattleState({
      playerHealth: 28,
      playerMaxHealth: 30,
      playerStatuses: defaultPlayerStatusValues({ burn: 5, block: 2 }),
      talentEffects: {
        ...defaultTalentEffects,
        healOnStatusCleanse: 10,
        overhealToBlockRatio: 0.5,
      },
    });
    const texts = makeTexts();

    const result = removeHarmfulPlayerStatuses(state, 1, texts);
    expect(result.playerHealth).toBe(30);
    expect(result.playerStatuses.block).toBe(6);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 2 });
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 4 });
  });
});

describe("applyPlayerStatusEffect", () => {
  it("adds the status amount to player", () => {
    const state = makeTestBattleState();
    const effect = { kind: "player-status" as const, status: "block" as const, amount: 5 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("doubles armor when player is below half health and armorDoubledBelowHalfHealth is active", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: {
        ...defaultTalentEffects,
        armorDoubledBelowHalfHealth: true,
      },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(8);
  });

  it("doubles armor on first armor card when firstArmorCardDoubled is active", () => {
    const state = patchBattleState({
      talentEffects: {
        ...defaultTalentEffects,
        firstArmorCardDoubled: true,
      },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(8);
    expect(result.flags.firstArmorCardDoubledUsed).toBe(true);
  });

  it("does not double armor on second armor card when flag is used", () => {
    const state = patchBattleState({
      talentEffects: {
        ...defaultTalentEffects,
        firstArmorCardDoubled: true,
      },
      flags: defaultCombatFlags({ firstArmorCardDoubledUsed: true }),
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 4 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(4);
  });

  it("grants block when armor crosses armorBlockThreshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ armor: 3 }),
      talentEffects: {
        ...defaultTalentEffects,
        armorBlockThreshold: 5,
        armorBlockAmount: 3,
      },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.armor).toBe(6);
    expect(result.playerStatuses.block).toBe(3);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 3 });
  });

  it("includes flatBlockGained on armorBlockThreshold procs", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ armor: 3 }),
      talentEffects: {
        ...defaultTalentEffects,
        armorBlockThreshold: 5,
        armorBlockAmount: 3,
      },
      gearEffects: { ...patchBattleState().gearEffects, flatBlockGained: 2 },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.block).toBe(5);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "block", amount: 5 });
  });

  it("does not grant block when armor does not cross threshold", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ armor: 1 }),
      talentEffects: {
        ...defaultTalentEffects,
        armorBlockThreshold: 5,
        armorBlockAmount: 3,
      },
    });
    const effect = { kind: "player-status" as const, status: "armor" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.armor).toBe(4);
    expect(result.playerStatuses.block).toBe(0);
  });
});

describe("applyPlayerDamageStatuses", () => {
  it("adds burn stacks from incoming burn damage", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ burn: 2 }),
    });
    const result = applyPlayerDamageStatuses(state, { damageType: "burn" }, 5);
    expect(result.playerStatuses.burn).toBe(7);
  });

  it("adds doubled bleed stacks from incoming bleed damage", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ bleed: 2 }),
    });
    const result = applyPlayerDamageStatuses(state, { damageType: "bleed" }, 5);
    expect(result.playerStatuses.bleed).toBe(12);
  });

  it("adds freeze stacks equal to actual damage dealt, halved only once", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ freeze: 0 }),
      talentEffects: { ...patchBattleState().talentEffects, receiveHalfFreezeDamage: true },
    });

    const result = applyPlayerDamageStatuses(state, { damageType: "freeze" }, 5);
    expect(result.playerStatuses.freeze).toBe(5);
  });

  it("does nothing when actual damage is zero", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ burn: 3 }),
    });
    const result = applyPlayerDamageStatuses(state, { damageType: "burn" }, 0);
    expect(result).toBe(state);
  });
});

describe("applyPlayerStatusEffect � forge integration", () => {
  it("applies forge burn burst when forge crosses threshold", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 3 },
      talentEffects: { ...makeTestBattleState().talentEffects, forgeBurnThreshold: 5, forgeBurnDamage: 4 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(6);
    expect(result.enemyStatuses.burn).toBe(4);

    expect(texts).toEqual([{ target: "player", kind: "status", stat: "forge", amount: 3 }]);
  });

  it("flatForgeGained increases forge from card effects", () => {
    const state = makeTestBattleState({
      talentEffects: { ...makeTestBattleState().talentEffects, flatForgeGained: 1 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("strips enemy armor when forge crosses forgeStripArmorThreshold", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 5 },
      enemyMitigation: defaultEnemyMitigation({ armor: 4 }),
      talentEffects: { ...makeTestBattleState().talentEffects, forgeStripArmorThreshold: 6 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyMitigation.armor).toBe(0);
  });

  it("forgeBlockBurst respects forgeToBlock synergy", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 5 },
      talentEffects: {
        ...makeTestBattleState().talentEffects,
        forgeToBlock: true,
        forgeBlockThreshold: 6,
        forgeBlockAmount: 10,
      },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.playerStatuses.block).toBe(17);
  });
});

describe("forge threshold boundaries", () => {
  it("forge burn burst fires on crossing threshold from below (3 -> 6, threshold 4)", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 3 },
      talentEffects: { ...makeTestBattleState().talentEffects, forgeBurnThreshold: 4, forgeBurnDamage: 7 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(6);
    expect(result.enemyStatuses.burn).toBe(7);
  });

  it("forge burn burst does NOT fire when oldForge exactly equals threshold (4 -> 7, threshold 4)", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 4 },
      talentEffects: { ...makeTestBattleState().talentEffects, forgeBurnThreshold: 4, forgeBurnDamage: 7 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyStatuses.burn).toBe(0);
  });

  it("forge block burst does NOT re-fire above threshold (7 -> 9, threshold 6)", () => {
    const state = makeTestBattleState({
      playerStatuses: { ...makeTestBattleState().playerStatuses, forge: 7 },
      talentEffects: { ...makeTestBattleState().talentEffects, forgeBlockThreshold: 6, forgeBlockAmount: 10 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(9);
    expect(result.playerStatuses.block).toBe(0);
  });
});

describe("addForgeToPlayer", () => {
  it("adds flatForgeGained to forge gain", () => {
    const state = makeTestBattleState({
      talentEffects: { ...makeTestBattleState().talentEffects, flatForgeGained: 1 },
    });
    const texts = makeTexts();
    const result = addForgeToPlayer(state, 3, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("does nothing when amount is zero after modifiers", () => {
    const state = makeTestBattleState();
    const result = addForgeToPlayer(state, 0);
    expect(result).toBe(state);
  });
});
