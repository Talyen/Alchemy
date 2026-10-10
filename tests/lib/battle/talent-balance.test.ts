import { describe, expect, it } from "vitest";
import { computeTalentEffects, type DamageType } from "@/lib/game-data";
import { computeCardDamageToEnemy } from "@/lib/battle/damage-calc";
import { applyPlayerStatusEffect, addForgeToPlayer } from "@/lib/battle/status-player";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyWishEffect } from "@/lib/battle/wish";
import { PersistedBattleStateSchema } from "@/lib/validation/save-schemas/persisted-battle-state";
import { patchBattleState, type BattleStatePatch } from "../../fixtures/battle";
import { makeTestCard } from "../../fixtures/cards";

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 10,
    playerMaxHealth: 40,
    rng: () => 0.99,
    ...patch,
  });
}

const scaling = computeTalentEffects({
  physical: ["physical-armored-fists", "physical-expert-blacksmith"],
  nature: ["nature-thornskin"],
  block: ["block-to-physical", "block-to-holy", "block-to-stun"],
  forge: ["forge-to-burn", "forge-to-holy", "forge-strength-2"],
});

function damage(state: ReturnType<typeof battle>, damageType: DamageType, amount = 4) {
  return computeCardDamageToEnemy(state, { kind: "damage", damageType, amount }).modifiedDamage;
}

describe("repeatability-based talent balance", () => {
  it("loads current percentages without reviving retired resource-scaling overrides", () => {
    const initial = battle({ talentEffects: scaling });
    const restored = PersistedBattleStateSchema.parse({
      ...initial,
      talentEffects: {
        ...initial.talentEffects,
        armorToPhysicalDamage: true,
        armorToNatureDamage: true,
        blockToHolyDamage: true,
        blockToStunDamage: true,
        forgeToBurn: true,
        forgeToHoly: true,
        forgeToBlock: true,
        forgeToBleed: true,
        armorDoubledBelowHalfHealth: true,
        forgeDoubledBelowHalfHealth: true,
      },
    });
    expect(restored.talentEffects).toEqual(initial.talentEffects);
  });

  it.each([
    ["physical", 15], // 4 base + 5 Forge + 4 Armor + 2 Block
    ["nature", 4],
    ["holy", 7],
    ["stun", 10],
    ["burn", 5],
    ["bleed", 5],
  ] as const)(
    "combines current %s resource conversions without restoring full-strength talent scaling",
    (type, expected) => {
      expect(damage(battle({ talentEffects: scaling, playerStatuses: { armor: 8, block: 20, forge: 4 } }), type)).toBe(
        expected,
      );
    },
  );

  it("retains full Forge from Homestead and Gear without adding the talent contribution twice", () => {
    const initial = battle({ talentEffects: scaling, playerStatuses: { forge: 8 } });
    expect(damage(initial, "burn")).toBe(6);
    const homestead = { ...initial, talentEffects: { ...scaling, homesteadForgeBurnPercent: 100 } };
    expect(damage(homestead, "burn")).toBe(12);
    expect(damage({ ...homestead, gearEffects: { ...initial.gearEffects, sharedBurnBleedBonuses: 1 } }, "bleed")).toBe(
      12,
    );
    expect(damage({ ...initial, gearEffects: { ...initial.gearEffects, oathkeeperHolyAndBlock: 1 } }, "holy")).toBe(8);
  });

  it("uses the larger shared Burn/Bleed conversion only once and preserves Forge", () => {
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "burn", amount: 4 }] });
    const state = battle({
      talentEffects: scaling,
      playerStatuses: { forge: 4 },
      gearEffects: { sharedBurnBleedBonuses: 1 },
      hand: [card],
    });
    const next = playBattleCardResolved(state, card.id, 0).state;
    expect(next.enemyHealth).toBe(95);
    expect(next.playerStatuses.forge).toBe(4);
  });

  it("keeps half-Health bonuses strict and rounds small gains", () => {
    const talents = computeTalentEffects({
      armor: ["armor-desperate-double"],
      forge: ["forge-strength-5"],
      physical: ["physical-unrelenting"],
    });
    for (const [health, gain, hit] of [
      [19, 5, 8],
      [20, 4, 4],
    ] as const) {
      const state = battle({ talentEffects: talents, playerHealth: health });
      expect(
        applyPlayerStatusEffect(state, { kind: "player-status", status: "armor", amount: 4 }, []).playerStatuses.armor,
      ).toBe(gain);
      expect(addForgeToPlayer(state, 4).playerStatuses.forge).toBe(4);
      expect(damage(state, "physical")).toBe(hit);
    }
    const tiny = battle({ talentEffects: talents });
    expect(addForgeToPlayer(tiny, 1).playerStatuses.forge).toBe(1);
  });

  it("feeds Overheat's Forge through Tempered Guard into Armored Surge", () => {
    const talents = computeTalentEffects({
      forge: ["forge-burn-burst", "forge-to-block"],
      armor: ["armor-block-burst"],
    });
    const forged = addForgeToPlayer(
      battle({ talentEffects: talents, rng: () => 0, playerStatuses: { forge: 3, burn: 1 } }),
      5,
    );
    const guarded = applyPlayerStatusEffect(forged, { kind: "player-status", status: "block", amount: 2 }, []);
    expect(forged.playerStatuses.forge).toBe(9);
    expect(guarded.playerStatuses).toMatchObject({ forge: 9, block: 4, armor: 4 });
    expect(guarded.enemyHealth).toBe(100);
  });

  it("guarantees the next Physical Crit and spends Parting Cut on the next attack", () => {
    const talents = computeTalentEffects({
      physical: ["physical-brute-force"],
      block: ["block-start"],
      bleed: ["bleed-physical-bonus"],
    });
    const dodged = applyEnemyAbility(
      battle({ talentEffects: talents, rng: () => 0 }),
      makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] }),
      [],
    );
    expect(dodged.playerHealth).toBe(10);
    expect(dodged.playerStatuses.block).toBe(2);
    expect(dodged.enemyHealth).toBe(100);
    const card = makeTestCard({ effects: [{ kind: "damage", damageType: "physical", amount: 8 }] });
    const next = playBattleCardResolved({ ...dodged, rng: () => 0.99, hand: [card] }, card.id, 0).state;
    expect(next.enemyHealth).toBe(76);
    expect(next.enemyStatuses.bleed).toBe(8);
    expect(next.flags.nextPhysicalDealsBleed).toBe(false);
  });

  it("broadens Desperate Wish to below half Health with a smaller recurring reward", () => {
    const talents = computeTalentEffects({ wish: ["wish-desperate"] });
    const card = makeTestCard({ effects: [{ kind: "wish", amount: 1 }] });
    expect(
      applyWishEffect(battle({ talentEffects: talents, playerHealth: 19 }), card, 1, []).playerStatuses.block,
    ).toBe(2);
    expect(
      applyWishEffect(battle({ talentEffects: talents, playerHealth: 20 }), card, 1, []).playerStatuses.block,
    ).toBe(0);
  });
});
