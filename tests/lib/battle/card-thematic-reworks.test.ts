import { describe, expect, it } from "vitest";
import { BattleCardEffectSchema, cardById, companionLibrary, getCardKeywords, type BattleCard } from "@/lib/game-data";
import { applyCardEffects } from "@/lib/battle/effect-handlers";
import { playBattleCardResolved } from "@/lib/battle/card-play";
import { applyEnemyAbility } from "@/lib/battle/enemy-turn-attack";
import { chooseWishCard } from "@/lib/battle/wish";
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

function sequenceRng(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0.99;
}

function play(id: string, patch: BattleStatePatch = {}) {
  const card = cardById[id]!;
  return playBattleCardResolved(battle({ ...patch, hand: [card] }), id, 0).state;
}

function playResolved(id: string, patch: BattleStatePatch = {}) {
  const card = cardById[id]!;
  return playBattleCardResolved(battle({ ...patch, hand: [card] }), id, 0);
}

describe("thematic card effects", () => {
  it("Combustion detonates all Burn, including the stack it adds", () => {
    const fresh = play("combustion");
    expect(fresh.enemyHealth).toBe(98);
    expect(fresh.enemyStatuses.burn).toBe(0);

    const stacked = play("combustion", { enemyStatuses: { burn: 3 } });
    expect(stacked.enemyHealth).toBe(95);
    expect(stacked.enemyStatuses.burn).toBe(0);
  });

  it("Golden Plate gains Armor and Gold, then Consumes", () => {
    const result = play("golden-plate");
    expect(result.playerStatuses.armor).toBe(3);
    expect(result.gold).toBe(3);
    expect(result.exhausted.some((card) => card.id === "golden-plate")).toBe(true);
  });

  it("Grasping Vines and Judgment each choose one 3-damage type", () => {
    const vinesStun = playResolved("grasping-vines", { rng: sequenceRng([0]) });
    expect(vinesStun.state.enemyHealth).toBe(97);
    expect(vinesStun.combatTexts).toContainEqual(expect.objectContaining({ kind: "damage", stat: "stun", amount: 3 }));

    const vinesNature = playResolved("grasping-vines", { rng: sequenceRng([0.99]) });
    expect(vinesNature.state.enemyHealth).toBe(97);
    expect(vinesNature.combatTexts).toContainEqual(
      expect.objectContaining({ kind: "damage", stat: "nature", amount: 3 }),
    );

    const judgmentHoly = playResolved("judgment", { rng: sequenceRng([0]) });
    expect(judgmentHoly.state.enemyHealth).toBe(97);
    expect(judgmentHoly.combatTexts).toContainEqual(
      expect.objectContaining({ kind: "damage", stat: "holy", amount: 3 }),
    );

    const judgmentStun = playResolved("judgment", { rng: sequenceRng([0.99]) });
    expect(judgmentStun.state.enemyHealth).toBe(97);
    expect(judgmentStun.combatTexts).toContainEqual(
      expect.objectContaining({ kind: "damage", stat: "stun", amount: 3 }),
    );
  });

  it("Hemorrhage detonates all Bleed, including its own stack", () => {
    const fresh = play("hemorrhage");
    expect(fresh.enemyHealth).toBe(96);
    expect(fresh.enemyStatuses.bleed).toBe(0);

    const stacked = play("hemorrhage", { enemyStatuses: { bleed: 3 } });
    expect(stacked.enemyHealth).toBe(93);
    expect(stacked.enemyStatuses.bleed).toBe(0);
  });

  it("Kindling doubles Burn only when the enemy was not already Burning and does not Consume", () => {
    const fresh = play("kindling");
    expect(fresh.enemyHealth).toBe(96);
    expect(fresh.enemyStatuses.burn).toBe(4);
    expect(fresh.exhausted.some((card) => card.id === "kindling")).toBe(false);

    const burning = play("kindling", { enemyStatuses: { burn: 1 } });
    expect(burning.enemyHealth).toBe(98);
    expect(burning.enemyStatuses.burn).toBe(3);
  });

  it("preserves legacy Combustion detonation semantics in complete saved cards", () => {
    const legacy: BattleCard = {
      ...cardById.combustion!,
      descriptionLines: ["Deal 1 Burn damage", "If the enemy was already Burning, detonate all its Burn"],
      effects: [{ kind: "damage", damageType: "burn", amount: 1, detonateIfEnemyBurning: true }],
    };
    const saved = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(legacy))));
    const freshTarget = applyCardEffects(battle(), saved, []);
    expect(freshTarget.enemyHealth).toBe(99);
    expect(freshTarget.enemyStatuses.burn).toBe(1);
    const burningTarget = applyCardEffects(battle({ enemyStatuses: { burn: 3 } }), saved, []);
    expect(burningTarget.enemyHealth).toBe(95);
    expect(burningTarget.enemyStatuses.burn).toBe(0);
  });

  it("Fire Arrow no longer strips enemy Armor", () => {
    const result = play("fire-arrow", { enemyMitigation: { armor: 2 } });
    expect(result.enemyHealth).toBe(99);
    expect(result.enemyMitigation.armor).toBe(1);
  });

  it("Dark Pact deals Burn, pays Health, and grants one Wish without drawing", () => {
    const result = play("dark-pact", { playerHealth: 10, deck: [makeTestCard({ id: "draw-me" })] });
    expect(result.enemyHealth).toBe(99);
    expect(result.enemyStatuses.burn).toBe(1);
    expect(result.playerHealth).toBe(9);
    expect(result.wishOptions).not.toBeNull();
    expect(result.hand).toHaveLength(0);
  });

  it("Fangs resolves one random 2-damage hit with Leech", () => {
    const result = play("fangs", { playerHealth: 90, rng: sequenceRng([0.99, 0.99]) });
    expect(result.enemyHealth).toBe(98);
    expect(result.enemyStatuses.bleed).toBe(0);
    expect(result.playerHealth).toBe(91);
  });

  it("Steal stuns the enemy and gains one Gold", () => {
    const result = play("steal");
    expect(result.enemyHealth).toBe(99);
    expect(result.enemyStatuses.stun).toBe(1);
    expect(result.gold).toBe(1);
  });

  it("Tithe deals fixed Holy damage and gains one Gold regardless of current Gold", () => {
    const result = play("tithe", { gold: 47 });
    expect(result.enemyHealth).toBe(99);
    expect(result.gold).toBe(48);
  });

  it.each([
    [0, "poison"],
    [0.99, "physical"],
  ] as const)("Venom Arrow resolves one 2-damage %s hit", (roll, damageType) => {
    const result = play("venom-arrow", { rng: sequenceRng([roll, 0.99]) });
    expect(result.enemyHealth).toBe(98);
    expect(result.enemyStatuses.poison).toBe(damageType === "poison" ? 2 : 0);
  });

  it("Blood Offering trades Health for cards without losing net Mana", () => {
    const drawA = makeTestCard({ id: "draw-a" });
    const drawB = makeTestCard({ id: "draw-b" });
    const result = play("blood-offering", { mana: 2, playerHealth: 20, deck: [drawA, drawB] });
    expect(result.playerHealth).toBe(19);
    expect(result.mana).toBe(2);
    expect(result.hand.map((card) => card.id).sort()).toEqual([drawA.id, drawB.id]);
    expect(cardById["blood-offering"]?.descriptionLines).toEqual(["Lose 1 Health", "Draw 2 cards", "Gain 1 Mana"]);
  });

  it("Venom Fangs deals one Poison damage and Leech heals the player", () => {
    const result = play("venom-fangs", { playerHealth: 90 });
    expect(result.enemyHealth).toBe(99);
    expect(result.enemyStatuses.poison).toBe(1);
    expect(result.playerHealth).toBe(91);
  });

  it("Wishing Potion Wishes once, draws a card, and Consumes", () => {
    const drawn = makeTestCard({ id: "drawn" });
    const result = play("wishing-potion", { deck: [drawn] });
    expect(result.wishOptions).not.toBeNull();
    expect(result.hand).toEqual([expect.objectContaining({ id: "drawn" })]);
    expect(result.exhausted.map((card) => card.id)).toContain("wishing-potion");
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

  it("Poison Dagger deals one Poison and prepares the next attack", () => {
    const result = play("poison-dagger");
    expect(result.enemyHealth).toBe(99);
    expect(result.enemyStatuses.poison).toBe(1);
    expect(result.flags.nextHitPoison).toBe(true);
  });

  it("Predator's Focus deals Bleed and prepares Leech without preparing a critical hit", () => {
    const result = play("predators-focus");
    expect(result.enemyHealth).toBe(99);
    expect(result.enemyStatuses.bleed).toBe(1);
    expect(result.flags.nextHitCrit).toBe(false);
    expect(result.flags.nextHitLeech).toBe(true);
  });

  it.each([
    [0, "physical"],
    [0.99, "stun"],
  ] as const)("Pounce chooses one random %s hit", (roll, status) => {
    const result = play("pounce", {
      enemyStatuses: { poison: 1 },
      talentEffects: { poisonPreventsEnemyDodge: true },
      rng: sequenceRng([roll, 0.99, 0.99]),
    });
    expect(result.enemyHealth).toBe(98);
    expect(result.enemyStatuses.stun).toBe(status === "stun" ? 2 : 0);
  });

  it("Ray of Frost deals two immediate Freeze hits", () => {
    const result = play("ray-of-frost");
    expect(result.enemyHealth).toBe(98);
    expect(result.enemyStatuses.freeze).toBe(2);
    expect(result.pendingTurnStartEffects).toHaveLength(0);
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

  it.each([
    ["serrated-edge", "physical", "bleed"],
    ["smite", "holy", "burn"],
  ] as const)("%s selects one pooled damage type", (id, _firstType, secondType) => {
    const first = play(id, { rng: sequenceRng([0, 0.99, 0.99]) });
    expect(first.enemyHealth).toBe(98);
    expect(first.enemyStatuses[secondType]).toBe(0);

    const second = play(id, { rng: sequenceRng([0.99, 0.99, 0.99]) });
    expect(second.enemyHealth).toBe(98);
    expect(second.enemyStatuses[secondType]).toBe(2);
  });

  it("Burning Blade gains Forge before reading it for Burn, including for enemies", () => {
    const hero = play("burning-blade", {
      playerStatuses: { forge: 4 },
      talentEffects: { forgeBurnDamagePercent: 100 },
    });
    expect(hero.enemyStatuses.burn).toBe(5);
    expect(hero.enemyHealth).toBe(95);
    expect(hero.playerStatuses.forge).toBe(4);
    const unheated = play("burning-blade");
    expect(unheated.enemyStatuses.burn).toBe(1);
    expect(unheated.enemyHealth).toBe(99);
    const base = battle({ roomScalingMultiplier: 2, enemyMitigation: { forge: 4 } });
    const enemy = applyEnemyAbility(base, cardById["burning-blade"]!, []);
    // Six live Forge receives ability pressure, without a second room multiplier.
    expect(enemy.playerStatuses.burn).toBe(10);
  });

  it("Avatar deals Holy damage before its equal-odds resource gain", () => {
    const block = play("avatar", { rng: sequenceRng([0.99, 0.99, 0]) });
    expect(block.enemyHealth).toBe(95);
    expect(block.playerStatuses.block).toBe(5);
    expect(block.playerStatuses.forge).toBe(0);

    const forge = play("avatar", { rng: sequenceRng([0.99, 0.99, 0.34]) });
    expect(forge.enemyHealth).toBe(95);
    expect(forge.playerStatuses.forge).toBe(5);

    const armor = play("avatar", { rng: sequenceRng([0.99, 0.99, 0.67]) });
    expect(armor.enemyHealth).toBe(95);
    expect(armor.playerStatuses.armor).toBe(5);
  });

  it("Blessed Aegis uses Block after its gain and rounds half values", () => {
    const result = play("blessed-aegis", { playerStatuses: { block: 3 } });
    expect(result.playerStatuses.block).toBe(5);
    expect(result.enemyHealth).toBe(97);
  });

  it("Cinderbloom deals one random elemental hit", () => {
    const burn = play("cinderbloom", {
      rng: sequenceRng([0, 0.99]),
      enemyStatuses: { poison: 1 },
      talentEffects: { poisonPreventsEnemyDodge: true },
    });
    expect(burn.enemyHealth).toBe(98);
    expect(burn.enemyStatuses.burn).toBe(2);

    const nature = play("cinderbloom", {
      rng: sequenceRng([0.99, 0.99]),
      enemyStatuses: { poison: 1 },
      talentEffects: { poisonPreventsEnemyDodge: true },
    });
    expect(nature.enemyHealth).toBe(98);
    expect(nature.enemyStatuses.burn).toBe(0);
  });

  it("corruption keeps Cauterize's combined Burn costs paired", () => {
    const card = cardById.cauterize!;
    const targets = getEditableCorruptionTargets(card);
    expect(targets).toHaveLength(1);
    const changed = applyNumericCorruption(card, targets[0]!, 1);
    expect(changed.descriptionLines).toContain("Deal and Receive 2 Burn damage");
    expect(changed.effects).toEqual(
      expect.arrayContaining([
        { kind: "damage", damageType: "burn", amount: 2 },
        { kind: "self-damage", damageType: "burn", amount: 2 },
      ]),
    );
    expect(changed.effects).toEqual(expect.arrayContaining([{ kind: "remove-harmful-status", amount: 1 }]));
    expect(validateCardDescriptionParity(changed)).toEqual([]);
  });

  it("Cleanse remains playable for its healing effect without a harmful status", () => {
    const result = play("cleanse", { playerHealth: 10, playerMaxHealth: 20 });
    expect(result.playerHealth).toBe(12);
    expect(result.playerStatuses.poison).toBe(0);
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
    expect(packTactics.descriptionLines).toEqual([
      "Your Companion acts twice",
      "If you don't have a Companion, Wish for one",
    ]);
    expect(validateCardDescriptionParity(packTactics)).toEqual([]);
    expect(getCardKeywords(packTactics)).not.toContain("wish");
    const utility = play("pack-tactics", { activeCompanion: companionLibrary["golden-retriever"] });
    expect(utility.gold).toBe(4);
    expect(utility.companionDamageBuff).toBe(0);
    expect(utility.wishOptions).toBeNull();
    const absent = play("pack-tactics");
    expect(absent.enemyHealth).toBe(100);
    expect(absent.companionDamageBuff).toBe(0);
    expect(absent.wishOptions).toHaveLength(3);
    expect(absent.wishOptions?.every((card) => card.effects.some((effect) => effect.kind === "summon-companion"))).toBe(
      true,
    );
    const chosen = absent.wishOptions![0]!;
    expect(chooseWishCard(absent, chosen.id).hand.some((card) => card.id === chosen.id)).toBe(true);
    const lethal = play("pack-tactics", { activeCompanion: companionLibrary.wolf, enemyHealth: 1 });
    expect(lethal.enemyHealth).toBe(0);
    expect(lethal.playerStatuses.block).toBe(0);
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
      ["burning-blade", "Gain 2 Forge", { kind: "player-status", amount: 2 }],
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

  it("Bellows Blast grants 2 Forge and deals 2 Burn damage", () => {
    const result = play("bellows-blast");
    expect(result.playerStatuses.forge).toBe(2);
    expect(result.enemyHealth).toBe(98);
    expect(result.enemyStatuses.burn).toBe(2);
  });

  it("Quench cleanses a harmful status effect and grants 1 Forge", () => {
    const afflicted = play("quench", { playerStatuses: { poison: 2 } });
    expect(afflicted.playerStatuses.poison).toBe(0);
    expect(afflicted.playerStatuses.forge).toBe(1);

    const clean = play("quench");
    expect(clean.playerStatuses.forge).toBe(1);
  });
});
