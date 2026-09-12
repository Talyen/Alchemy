import { describe, expect, it } from "vitest";
import { BattleCardEffectSchema, cardById, companionLibrary, type BattleCard } from "@/lib/game-data";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { getEnemyAbilityPressure } from "@/lib/battle/battle-enemy-setup";
import { applyNumericCorruption, getEditableCorruptionTargets } from "@/lib/corruption/numeric";
import { validateCardDescriptionParity } from "@/lib/content-validation/card-parity";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { makeTestCard, patchBattleState, type BattleStatePatch } from "../../fixtures/battle";

function battle(patch: BattleStatePatch = {}) {
  return patchBattleState({
    enemyHealth: 100,
    enemyMaxHealth: 100,
    playerHealth: 100,
    playerMaxHealth: 100,
    rng: () => 0.99,
    ...patch,
  });
}

function play(id: string, patch: BattleStatePatch = {}) {
  const card = cardById[id]!;
  return playBattleCardResolved(battle({ ...patch, hand: [card] }), id, 0).state;
}

describe("thematic card effects", () => {
  it("Stab bypasses Armor on both sides while Block still absorbs the hit", () => {
    const hero = play("stab", { enemyMitigation: { armor: 20, block: 2 } });
    expect(hero.enemyHealth).toBe(98);
    expect(hero.enemyMitigation).toMatchObject({ armor: 19, block: 0 });
    const base = battle({ playerStatuses: { armor: 20, block: 2 } });
    const enemy = applyEnemyAbility(
      {
        ...base,
        difficultyModifiers: [{ kind: "enemy-damage-multiplier", amount: 1 / getEnemyAbilityPressure(base) }],
      },
      cardById.stab!,
      [],
    );
    expect(enemy.playerHealth).toBe(98);
    expect(enemy.playerStatuses).toMatchObject({ armor: 19, block: 0 });
    expect(base.playerStatuses).toMatchObject({ armor: 20, block: 2 });
  });

  it("Burning Blade reads live Forge once before the Physical hit, including for enemies", () => {
    const hero = play("burning-blade", { playerStatuses: { forge: 4 }, talentEffects: { forgeToBurn: true } });
    expect(hero.enemyStatuses.burn).toBe(4);
    expect(hero.enemyHealth).toBe(91);
    expect(hero.playerStatuses.forge).toBe(2);
    const unheated = play("burning-blade");
    expect(unheated.enemyStatuses.burn).toBe(0);
    expect(unheated.enemyHealth).toBe(98);
    const base = battle({ roomScalingMultiplier: 2, enemyMitigation: { forge: 4 } });
    const enemy = applyEnemyAbility(base, cardById["burning-blade"]!, []);
    expect(enemy.playerStatuses.burn).toBe(4);
  });

  it("Roll the Dice draws each die result, respects hand capacity, and Consumes once", () => {
    const deck = Array.from({ length: 10 }, (_, uid) => makeTestCard({ uid, id: `draw-${uid}` }));
    for (let face = 1; face <= 6; face += 1) {
      const result = play("roll-the-dice", { deck, rng: () => (face - 0.5) / 6 });
      expect(result.hand).toHaveLength(face);
      expect(result.exhausted.filter((card) => card.id === "roll-the-dice")).toHaveLength(1);
      expect(result.enemyHealth).toBe(100);
      expect(result.gold).toBe(0);
    }
    const result = applyCardEffects(battle({ deck, hand: deck.slice(0, 6) }), cardById["roll-the-dice"]!, []);
    expect(result.hand).toHaveLength(7);
    expect(result.deck).toHaveLength(9);
  });

  it("Pack Tactics repeats utility actions, does nothing without a Companion, and stops on victory", () => {
    const utility = play("pack-tactics", { activeCompanion: companionLibrary["golden-retriever"] });
    expect(utility.gold).toBe(2);
    expect(utility.companionDamageBuff).toBe(0);
    const absent = play("pack-tactics");
    expect(absent.enemyHealth).toBe(100);
    expect(absent.companionDamageBuff).toBe(0);
    const lethal = play("pack-tactics", { activeCompanion: companionLibrary.wolf, enemyHealth: 1 });
    expect(lethal.enemyHealth).toBe(0);
    expect(lethal.playerStatuses.block).toBe(1);
  });

  it("Sunder removes Armor before striking and Acid strips all Armor even behind Block", () => {
    const sunder = play("sunder", { enemyMitigation: { armor: 5 } });
    expect(sunder.enemyHealth).toBe(99);
    expect(sunder.enemyMitigation.armor).toBe(2);
    const acid = play("acid-potion", { enemyMitigation: { armor: 40, block: 4 } });
    expect(acid.enemyMitigation).toMatchObject({ armor: 0, block: 3 });
    expect(acid.enemyHealth).toBe(100);
    expect(play("acid-potion").enemyStatuses.poison).toBe(1);
  });

  it("upgrades actual damage and Companion actions without editing hidden placeholder amounts", () => {
    for (const [id, line, expected] of [
      ["acid-potion", "Deal 2 Poison damage", { kind: "damage", amount: 2 }],
      ["burning-blade", "Deal 3 Physical damage", { kind: "damage", amount: 3 }],
      ["pack-tactics", "Your Companion acts 3 times", { kind: "companion-action", amount: 3 }],
    ] as const) {
      const original = cardById[id]!;
      const targets = getEditableCorruptionTargets(original);
      expect(targets).toHaveLength(1);
      const changed = applyNumericCorruption(original, targets[0]!, 1);
      expect(changed.descriptionLines).toContain(line);
      expect(changed.effects).toEqual(expect.arrayContaining([expect.objectContaining(expected)]));
      expect(validateCardDescriptionParity(changed)).toEqual([]);
      expect(hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(changed))))).toMatchObject({
        effects: changed.effects,
        descriptionLines: changed.descriptionLines,
      });
    }
    expect(BattleCardEffectSchema.safeParse({ kind: "random-draw", minAmount: 6, maxAmount: 1 }).success).toBe(false);
    expect(
      BattleCardEffectSchema.safeParse({
        kind: "damage",
        damageType: "burn",
        amount: 0,
        equalToForge: true,
        equalToArmor: true,
      }).success,
    ).toBe(false);
  });

  it("preserves the old saved Pack Tactics effect and description as a complete unit", () => {
    const legacy: BattleCard = {
      ...cardById["pack-tactics"]!,
      descriptionLines: ["Increase Companion damage by 1", "Deal 3 Nature damage"],
      effects: [
        { kind: "buff-companion", amount: 1 },
        { kind: "damage", damageType: "nature", amount: 3 },
      ],
    };
    const saved = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(legacy))));
    expect(saved.effects).toEqual(legacy.effects);
    expect(saved.descriptionLines).toEqual(legacy.descriptionLines);
    const result = applyCardEffects(battle(), saved, []);
    expect(result.companionDamageBuff).toBe(1);
    expect(result.enemyHealth).toBe(97);
  });
});
