import { describe, expect, it } from "vitest";
import {
  addForgeToPlayer,
  applyCardHealing,
  applyPlayerDamageStatuses,
  applyPlayerStatusEffect,
  removeHarmfulPlayerStatuses,
} from "@/lib/battle/status-player";
import { removePlayerArmor } from "@/lib/battle/status-helpers";
import { makeTestCard } from "../../fixtures/cards";
import { makeCombatTexts as makeTexts, patchBattleState } from "../../fixtures/battle";
import {
  defaultPlayerStatusValues,
  defaultTalentEffects,
  defaultTrinketManifest,
  defaultCombatFlags,
} from "../../fixtures/default-battle-state";

describe("applyPlayerStatusEffect — armor talent thresholds", () => {
  it.each(["armor break", "overheal"])("applies Block gain rewards once after %s", (source) => {
    const holy = makeTestCard({ id: "holy-draw", tags: ["holy"] });
    const state = patchBattleState({
      playerHealth: 30,
      playerMaxHealth: 30,
      playerStatuses: { armor: 1 },
      deck: [holy],
      talentEffects: {
        armorBreakBlock: 3,
        overhealToBlockRatio: 1,
        armorOnBlockChance: 100,
        drawHolyOnBlockChance: 100,
      },
    });
    const next = source === "armor break" ? removePlayerArmor(state, 1, []) : applyCardHealing(state, 3, []);
    expect(next.playerStatuses.block).toBe(3);
    expect(next.playerStatuses.armor).toBe(source === "armor break" ? 3 : 4);
    expect(next.hand.map((card) => card.id)).toEqual([holy.id]);
  });

  it("Armored Surge can grant Armor from a Block gain", () => {
    const state = patchBattleState({
      rng: () => 0,
      talentEffects: { ...defaultTalentEffects, armorOnBlockChance: 100 },
    });
    const result = applyPlayerStatusEffect(state, { kind: "player-status", status: "block", amount: 3 }, makeTexts());
    expect(result.playerStatuses.block).toBe(3);
    expect(result.playerStatuses.armor).toBe(3);
  });

  it("Reinforced doubles Armor and Purification cleanses one harmful status", () => {
    const state = patchBattleState({
      rng: () => 0,
      playerStatuses: defaultPlayerStatusValues({ poison: 2, bleed: 2 }),
      talentEffects: { ...defaultTalentEffects, armorDoubleChance: 100, armorCleanseChance: 100 },
    });
    const result = applyPlayerStatusEffect(state, { kind: "player-status", status: "armor", amount: 2 }, makeTexts());
    expect(result.playerStatuses.armor).toBe(4);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.bleed).toBe(2);
  });

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

  it("heals with sinEater for each removed status", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerStatuses: defaultPlayerStatusValues({ burn: 5, poison: 3 }),
      trinketEffects: defaultTrinketManifest({ sinEaterHealOnHarmfulStatusRemove: 4 }),
    });
    const texts = makeTexts();
    const result = removeHarmfulPlayerStatuses(state, 2, texts);

    expect(result.playerHealth).toBe(28);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 8 });
  });

  it("does nothing when no statuses to remove", () => {
    const state = patchBattleState({
      playerHealth: 20,
      trinketEffects: defaultTrinketManifest({ sinEaterHealOnHarmfulStatusRemove: 4 }),
    });
    const result = removeHarmfulPlayerStatuses(state, 1);
    expect(result.playerHealth).toBe(20);
  });

  it("cleanse healing cannot grant Overflow Block", () => {
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
    expect(result.playerStatuses.block).toBe(2);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 10 });
    expect(texts).not.toContainEqual(expect.objectContaining({ stat: "block" }));
  });
});

describe("applyPlayerStatusEffect", () => {
  it("adds the status amount to player", () => {
    const state = patchBattleState();
    const effect = { kind: "player-status" as const, status: "block" as const, amount: 5 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.block).toBe(5);
  });

  it("doubles armor when player is below half health and armorLowHealthBonusPercent is active", () => {
    const state = patchBattleState({
      playerHealth: 10,
      playerMaxHealth: 30,
      talentEffects: {
        ...defaultTalentEffects,
        armorLowHealthBonusPercent: 100,
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

  it("adds bleed stacks from incoming bleed damage", () => {
    const state = patchBattleState({
      playerStatuses: defaultPlayerStatusValues({ bleed: 2 }),
    });
    const result = applyPlayerDamageStatuses(state, { damageType: "bleed" }, 5);
    expect(result.playerStatuses.bleed).toBe(7);
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

describe("applyPlayerStatusEffect — forge integration", () => {
  it("flatForgeGained increases forge from card effects", () => {
    const state = patchBattleState({
      talentEffects: { flatForgeGained: 1 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const texts = makeTexts();
    const result = applyPlayerStatusEffect(state, effect, texts);
    expect(result.playerStatuses.forge).toBe(4);
    expect(texts).toContainEqual({ target: "player", kind: "status", stat: "forge", amount: 4 });
  });

  it("forgeBlockBurst respects forgeBlockPercent synergy", () => {
    const state = patchBattleState({
      playerStatuses: { forge: 5 },
      talentEffects: {
        forgeBlockPercent: 100,
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
  it("preserves all rewards and combat text order when one gain crosses every threshold", () => {
    const state = patchBattleState({
      playerStatuses: { forge: 3 },
      enemyMitigation: { armor: 5 },
      talentEffects: {
        forgeBurnThreshold: 4,
        forgeBurnDamage: 2,
        forgeStripArmorThreshold: 5,
        forgeBlockThreshold: 6,
        forgeBlockAmount: 7,
      },
    });
    const texts = makeTexts();
    const result = addForgeToPlayer(state, 3, texts);
    expect(result.playerStatuses.forge).toBe(6);
    expect(result.enemyStatuses.burn).toBe(2);
    expect(result.enemyMitigation.armor).toBe(0);
    expect(result.playerStatuses.block).toBe(7);
    expect(texts).toEqual([
      { target: "enemy", kind: "damage", stat: "burn", amount: 2 },
      { target: "player", kind: "status", stat: "block", amount: 7 },
      { target: "player", kind: "status", stat: "forge", amount: 3 },
    ]);
    expect(state.playerStatuses.forge).toBe(3);
    expect(state.enemyMitigation.armor).toBe(5);
  });

  it("forge burn burst does NOT fire when oldForge exactly equals threshold (4 -> 7, threshold 4)", () => {
    const state = patchBattleState({
      playerStatuses: { forge: 4 },
      talentEffects: { forgeBurnThreshold: 4, forgeBurnDamage: 7 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 3 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(7);
    expect(result.enemyStatuses.burn).toBe(0);
  });

  it("forge block burst does NOT re-fire above threshold (7 -> 9, threshold 6)", () => {
    const state = patchBattleState({
      playerStatuses: { forge: 7 },
      talentEffects: { forgeBlockThreshold: 6, forgeBlockAmount: 10 },
    });
    const effect = { kind: "player-status" as const, status: "forge" as const, amount: 2 };
    const result = applyPlayerStatusEffect(state, effect, []);
    expect(result.playerStatuses.forge).toBe(9);
    expect(result.playerStatuses.block).toBe(0);
  });
});

describe("addForgeToPlayer", () => {
  it("does nothing when amount is zero after modifiers", () => {
    const state = patchBattleState();
    const result = addForgeToPlayer(state, 0);
    expect(result).toBe(state);
  });
});

describe("low-health resource bonuses", () => {
  it.each([14, 15, 16])("requires strictly below half Health at %s/30", (playerHealth) => {
    const state = patchBattleState({
      playerHealth,
      playerMaxHealth: 30,
      talentEffects: { armorLowHealthBonusPercent: 100, forgeLowHealthBonusPercent: 100 },
    });
    const armor = applyPlayerStatusEffect(state, { kind: "player-status", status: "armor", amount: 4 }, []);
    const forge = addForgeToPlayer(state, 4);
    expect(armor.playerStatuses.armor).toBe(playerHealth < 15 ? 8 : 4);
    expect(forge.playerStatuses.forge).toBe(playerHealth < 15 ? 8 : 4);
  });
});
