import { describe, expect, it, vi } from "vitest";
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

describe("Armor gain rewards", () => {
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

  it("Reinforced doubles Armor and Purification cleanses one harmful status", () => {
    const state = patchBattleState({
      rng: () => 0,
      playerStatuses: { poison: 2, bleed: 2 },
      talentEffects: { armorDoubleChance: 100, armorCleanseChance: 100 },
    });
    const result = applyPlayerStatusEffect(state, { kind: "player-status", status: "armor", amount: 2 }, makeTexts());
    expect(result.playerStatuses.armor).toBe(4);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.bleed).toBe(2);
  });
});

describe("removeHarmfulPlayerStatuses", () => {
  it("removes statuses in priority order", () => {
    const state = patchBattleState({
      playerStatuses: { burn: 5, poison: 3, bleed: 2 },
    });
    const result = removeHarmfulPlayerStatuses(state, 2);
    expect(result.playerStatuses.burn).toBe(0);
    expect(result.playerStatuses.poison).toBe(0);
    expect(result.playerStatuses.bleed).toBe(2);
  });

  it("heals with sinEater for each removed status", () => {
    const state = patchBattleState({
      playerHealth: 20,
      playerStatuses: { burn: 5, poison: 3 },
      trinketEffects: { sinEaterHealOnHarmfulStatusRemove: 4 },
    });
    const texts = makeTexts();
    const result = removeHarmfulPlayerStatuses(state, 2, texts);

    expect(result.playerHealth).toBe(28);
    expect(texts).toContainEqual({ target: "player", kind: "heal", stat: "health", amount: 8 });
  });

  it("cleanse healing cannot grant Overflow Block", () => {
    const state = patchBattleState({
      playerHealth: 28,
      playerMaxHealth: 30,
      playerStatuses: { burn: 5, block: 2 },
      talentEffects: {
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

describe("applyPlayerDamageStatuses", () => {
  it("adds freeze stacks equal to actual damage dealt, halved only once", () => {
    const state = patchBattleState({
      playerStatuses: { freeze: 0 },
      talentEffects: { receiveHalfFreezeDamage: true },
    });

    const result = applyPlayerDamageStatuses(state, { damageType: "freeze" }, 5);
    expect(result.playerStatuses.freeze).toBe(5);
  });

  it("does nothing when actual damage is zero", () => {
    const state = patchBattleState({
      playerStatuses: { burn: 3 },
    });
    const result = applyPlayerDamageStatuses(state, { damageType: "burn" }, 0);
    expect(result).toBe(state);
  });
});

it("Tempered Guard reads Forge after Overheat and Intensify modify its gain", () => {
  const state = patchBattleState({
    playerStatuses: { forge: 5, burn: 1 },
    talentEffects: { forgeBlockPercent: 50, forgeBurningBonusChance: 100, forgeBonusChance: 100 },
  });
  const forged = applyPlayerStatusEffect(state, { kind: "player-status", status: "forge", amount: 2 }, []);
  const guarded = applyPlayerStatusEffect(forged, { kind: "player-status", status: "block", amount: 2 }, []);
  expect(forged.playerStatuses.forge).toBe(9);
  expect(guarded.playerStatuses.block).toBe(7);
  expect(state.playerStatuses.forge).toBe(5);
});

describe("addForgeToPlayer", () => {
  it("does nothing when amount is zero after modifiers", () => {
    const rng = vi.fn(() => 0.5);
    const state = patchBattleState({ rng, talentEffects: { forgeBonusChance: 10 } });
    const result = addForgeToPlayer(state, 0);
    expect(result).toBe(state);
    expect(rng).not.toHaveBeenCalled();
  });
});

describe("low-health resource bonuses", () => {
  it.each([14, 15, 16])("requires strictly below half Health at %s/30", (playerHealth) => {
    const state = patchBattleState({
      playerHealth,
      playerMaxHealth: 30,
      talentEffects: { armorLowHealthBonusPercent: 100, forgeLowHealthBonusChance: 100 },
    });
    const armor = applyPlayerStatusEffect(state, { kind: "player-status", status: "armor", amount: 4 }, []);
    const forge = addForgeToPlayer(state, 4);
    expect(armor.playerStatuses.armor).toBe(playerHealth < 15 ? 8 : 4);
    expect(forge.playerStatuses.forge).toBe(playerHealth < 15 ? 5 : 4);
  });
});
