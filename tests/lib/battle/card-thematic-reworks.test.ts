import { describe, expect, it } from "vitest";
import { cardById, companionLibrary, getCardKeywords } from "@/lib/game-data";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { chooseWishCard } from "@/lib/battle/wish";
import { getEnemyAbilityPressure } from "@/lib/battle/battle-enemy-setup";
import {
  applyNumericCorruption,
  getCorruptionTargetEffect,
  getEditableCorruptionTargets,
} from "@/lib/corruption/numeric";
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

function sequenceRng(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0.99;
}

function play(id: string, patch: BattleStatePatch = {}) {
  const card = cardById[id]!;
  return playBattleCardResolved(battle({ ...patch, hand: [card] }), id, 0).state;
}

describe("thematic card effects", () => {
  it.each([
    ["combustion", "burn", 2],
    ["hemorrhage", "bleed", 4],
  ] as const)("%s detonates existing stacks and the stacks it adds", (id, status, added) => {
    for (const stacks of [0, 3]) {
      const result = play(id, { enemyStatuses: { [status]: stacks } });
      expect(result.enemyHealth).toBe(100 - added - stacks);
      expect(result.enemyStatuses[status]).toBe(0);
    }
  });

  it.each([
    [0, "stun"],
    [0.99, "nature"],
  ] as const)("resolves exactly one pooled hit at roll %s", (roll, stat) => {
    const card = cardById["grasping-vines"]!;
    const result = playBattleCardResolved(battle({ hand: [card], rng: sequenceRng([roll, 0.99]) }), card.id, 0);
    expect(result.state.enemyHealth).toBe(97);
    expect(result.combatTexts.filter((event) => event.kind === "damage")).toEqual([
      expect.objectContaining({ target: "enemy", stat, amount: 3 }),
    ]);
  });

  it("Kindling triples Burn only when the enemy was not already Burning and does not Consume", () => {
    const fresh = play("kindling");
    expect(fresh.enemyHealth).toBe(97);
    expect(fresh.enemyStatuses.burn).toBe(3);
    expect(fresh.exhausted.some((card) => card.id === "kindling")).toBe(false);

    const burning = play("kindling", { enemyStatuses: { burn: 1 } });
    expect(burning.enemyHealth).toBe(99);
    expect(burning.enemyStatuses.burn).toBe(2);
  });

  it("Wishing Well keeps its Wish-or-Gold chance branches", () => {
    const wished = play("wishing-well", { rng: () => 0 });
    expect(wished.wishOptions).not.toBeNull();
    expect(wished.gold).toBe(0);

    const gold = play("wishing-well", { rng: () => 0.99 });
    expect(gold.wishOptions).toBeNull();
    expect(gold.gold).toBe(1);

    const original = cardById["wishing-well"]!;
    const target = getEditableCorruptionTargets(original)[0]!;
    const changed = applyNumericCorruption(original, target, 1);
    expect(changed.descriptionLines).toEqual(["Gain 2 Gold or Wish"]);
    expect(changed.effects[0]).toMatchObject({
      kind: "chance",
      successEffects: [{ kind: "wish", amount: 1 }],
      failureEffects: [{ kind: "gain-gold", amount: 2 }],
    });
    expect(validateCardDescriptionParity(changed)).toEqual([]);
  });

  it("Rend doubles its one Bleed hit only when Bleed was already present", () => {
    const fresh = play("rend");
    expect(fresh.enemyHealth).toBe(99);
    expect(fresh.enemyStatuses.bleed).toBe(1);

    const bleeding = play("rend", { enemyStatuses: { bleed: 1 } });
    expect(bleeding.enemyHealth).toBe(98);
    expect(bleeding.enemyStatuses.bleed).toBe(3);
  });

  it("Stab bypasses and preserves Armor and Block on both sides", () => {
    const hero = play("stab", { enemyMitigation: { armor: 20, block: 2 } });
    expect(hero.enemyHealth).toBe(97);
    expect(hero.enemyMitigation).toMatchObject({ armor: 19, block: 2 });
    const base = battle({ playerStatuses: { armor: 20, block: 2 } });
    const enemy = applyEnemyAbility(
      {
        ...base,
        difficultyModifiers: [{ kind: "enemy-damage-multiplier", amount: 1 / getEnemyAbilityPressure(base) }],
      },
      cardById.stab!,
      [],
    );
    expect(enemy.playerHealth).toBe(97);
    expect(enemy.playerStatuses).toMatchObject({ armor: 19, block: 2 });
    expect(base.playerStatuses).toMatchObject({ armor: 20, block: 2 });
  });

  it("Burning Blade reads half of live Forge without generating or spending it, including for enemies", () => {
    const hero = play("burning-blade", {
      playerStatuses: { forge: 4 },
      talentEffects: { forgeBurnDamagePercent: 100 },
    });
    expect(hero.enemyStatuses.burn).toBe(3);
    expect(hero.enemyHealth).toBe(97);
    expect(hero.playerStatuses.forge).toBe(4);
    const unheated = play("burning-blade");
    expect(unheated.enemyStatuses.burn).toBe(1);
    expect(unheated.enemyHealth).toBe(99);
    const base = battle({ roomScalingMultiplier: 2, enemyMitigation: { forge: 4 } });
    const enemy = applyEnemyAbility(base, cardById["burning-blade"]!, []);
    // The base is room-scaled once; the existing Forge is not scaled again.
    expect(enemy.playerStatuses.burn).toBe(7);
    expect(enemy.enemyMitigation.forge).toBe(4);
  });

  it.each([
    [0, "block", 5],
    [0.34, "forge", 2],
    [0.67, "armor", 5],
  ] as const)("Avatar selects one resource at roll %s", (roll, status, amount) => {
    const result = play("avatar", { rng: sequenceRng([0.99, 0.99, roll]) });
    expect(result.enemyHealth).toBe(95);
    expect(result.playerStatuses).toMatchObject({ block: 0, forge: 0, armor: 0, [status]: amount });
  });

  it("Blessed Aegis uses Block after its gain and rounds half values", () => {
    const result = play("blessed-aegis", { playerStatuses: { block: 3 } });
    expect(result.playerStatuses.block).toBe(5);
    expect(result.enemyHealth).toBe(97);
  });

  it.each([
    [0, 97, 2],
    [0.99, 98, 0],
  ])("Cinderbloom ignites Poison only when the selected hit Burns (roll %s)", (roll, health, burn) => {
    const result = play("cinderbloom", {
      rng: sequenceRng([roll, 0.99]),
      enemyStatuses: { poison: 1 },
      talentEffects: { poisonPreventsEnemyDodge: true },
    });
    expect(result.enemyHealth).toBe(health);
    expect(result.enemyStatuses.burn).toBe(burn);
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
    expect(result.pendingHandCards).toHaveLength(5);
    expect(result.deck).toHaveLength(4);
  });

  it("Pack Tactics acts twice with a Companion or Wishes for a summon without one", () => {
    const packTactics = cardById["pack-tactics"]!;
    expect(getCardKeywords(packTactics)).not.toContain("wish");
    const utility = play("pack-tactics", { activeCompanion: companionLibrary["golden-retriever"] });
    expect(utility.gold).toBe(4);
    expect(utility.wishOptions).toBeNull();
    expect(utility.playerStatuses.block).toBe(2);
    const absent = play("pack-tactics");
    expect(absent.enemyHealth).toBe(100);
    expect(absent.playerStatuses.block).toBe(2);
    expect(absent.wishOptions).toHaveLength(3);
    expect(absent.wishOptions?.every((card) => card.effects.some((effect) => effect.kind === "summon-companion"))).toBe(
      true,
    );
    const chosen = absent.wishOptions![0]!;
    expect(chooseWishCard(absent, chosen.id).hand.some((card) => card.id === chosen.id)).toBe(true);
    const lethal = play("pack-tactics", { activeCompanion: companionLibrary.wolf, enemyHealth: 1 });
    expect(lethal.enemyHealth).toBe(0);
    expect(lethal.playerStatuses.block).toBe(2);
    expect(lethal.wishOptions).toBeNull();
  });

  it("Pack Tactics grants normal Wish rewards only when it offers a Companion", () => {
    const trinketEffects = { wishingWellGoldOnWish: 3 };
    const absent = play("pack-tactics", { trinketEffects });
    expect(absent.gold).toBe(3);
    const active = play("pack-tactics", { activeCompanion: companionLibrary.wolf, trinketEffects });
    expect(active.gold).toBe(0);
  });

  it("Sunder halves Armor before striking and Acid halves Armor behind Block", () => {
    const sunder = play("sunder", { enemyMitigation: { armor: 5 } });
    expect(sunder.enemyHealth).toBe(100);
    expect(sunder.enemyMitigation.armor).toBe(3);
    const acid = play("acid-potion", { enemyMitigation: { armor: 40, block: 4 } });
    expect(acid.enemyMitigation).toMatchObject({ armor: 20, block: 2 });
    expect(acid.enemyHealth).toBe(100);
    expect(play("acid-potion").enemyStatuses.poison).toBe(2);
  });

  it("upgrades actual damage and Companion actions without editing hidden placeholder amounts", () => {
    for (const [id, line, expected] of [
      ["acid-potion", "Deal 3 Poison damage", { kind: "damage", amount: 3 }],
      ["burning-blade", "Deal 2 Burn damage, increased by half your Forge", { kind: "damage", amount: 2 }],
      ["pack-tactics", "Your Companion acts 3 times", { kind: "companion-action", amount: 3 }],
    ] as const) {
      const original = cardById[id]!;
      const target = getEditableCorruptionTargets(original).find(
        (entry) => getCorruptionTargetEffect(original, entry)?.kind === expected.kind,
      )!;
      const changed = applyNumericCorruption(original, target, 1);
      expect(changed.descriptionLines).toContain(line);
      expect(changed.effects).toEqual(expect.arrayContaining([expect.objectContaining(expected)]));
      if (id === "pack-tactics") {
        expect(changed.effects).toContainEqual({ kind: "player-status", status: "block", amount: 2 });
      }
      expect(validateCardDescriptionParity(changed)).toEqual([]);
      expect(hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(changed))))).toMatchObject({
        effects: changed.effects,
        descriptionLines: changed.descriptionLines,
      });
    }
  });
});
