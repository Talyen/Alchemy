import { describe, expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle";
import { makeState } from "../../fixtures/battle";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";
import {
  cardById,
  cardLibrary,
  cloneBattleCard,
  createEffectDescription,
  getCardKeywords,
  withCardDescription,
  type BattleCard,
  type BattleCardEffect,
  type KeywordId,
} from "@/lib/game-data";
import { createTransmutationOffers, getTransmutationVariants, isTransmutableCard } from "@/lib/alchemist/transmutation";
import { TRANSMUTATION_KEYWORD_GROUPS, TRANSMUTATION_PREFIXES } from "@/lib/game-constants/transmutation";
import { createSeededRng } from "@/lib/rng";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { corruptCard } from "@/lib/corruption";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { createMixedPotion, doublePotionPotency } from "@/lib/alchemist";

function card(effects: BattleCardEffect[]): BattleCard {
  return withCardDescription({ ...cardById.slash!, uid: 17, effects }, createEffectDescription(effects));
}

function numericFields(value: unknown, path = ""): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      typeof child === "number" ? [[`${path}/${key}`, child]] : Object.entries(numericFields(child, `${path}/${key}`)),
    ),
  );
}

describe("Transmutation alterations", () => {
  it("adds Archery to Exorcism and applies its attack bonuses without changing the Health cost", () => {
    const source = cardById.exorcism!;
    const result = getTransmutationVariants(source, "archery", [source])[0]?.result;
    expect(result).toBeDefined();
    expect(result!.effects).toEqual(source.effects);
    const state = makeState({ playerHealth: 20, playerStatuses: defaultPlayerStatusValues({ burn: 4 }) });
    const before = applyCardEffects(state, source, []);
    const after = applyCardEffects(
      { ...state, talentEffects: { ...state.talentEffects, archeryDamageWithoutBlock: 3 } },
      result!,
      [],
    );
    expect(before.enemyHealth - after.enemyHealth).toBe(3);
    expect(after.playerHealth).toBe(before.playerHealth);
  });

  it.each(["gamblers-shot", "exorcism"] as const)("adds persistent Leech to %s and heals from its damage", (id) => {
    const source = cardById[id]!;
    const result = getTransmutationVariants(source, "leech", [source])[0]?.result;
    expect(result).toBeDefined();
    const loaded = hydrateCard(BattleCardSchema.parse(result));
    expect(loaded).toEqual(result);
    expect(getCardKeywords(loaded)).toContain("leech");
    expect(loaded.descriptionLines).toContain("Leech");
    const state = makeState({
      playerHealth: 10,
      playerStatuses: defaultPlayerStatusValues({ burn: 4 }),
      rng: () => 0.99,
    });
    const before = applyCardEffects(state, source, []);
    const after = applyCardEffects(state, loaded, []);
    expect(after.enemyHealth).toBe(before.enemyHealth);
    expect(after.playerStatuses).toEqual(before.playerStatuses);
    expect(after.playerHealth - before.playerHealth).toBe(Math.round((state.enemyHealth - before.enemyHealth) / 2));
    expect(after.playerHealth).toBeGreaterThan(before.playerHealth);
  });

  it("converts Gambler's Shot damage pools without changing its random magnitude range", () => {
    const source = cardById["gamblers-shot"]!;
    const variants = getTransmutationVariants(source, "burn", [source]);
    expect(variants.map((variant) => variant.sourceKeyword)).toEqual(["stun", "physical", "bleed"]);
    expect(variants[1]!.result.effects).toEqual([
      { kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["stun", "burn", "bleed"] },
    ]);
    expect(hydrateCard(BattleCardSchema.parse(variants[1]!.result))).toEqual(variants[1]!.result);
  });

  it("keeps the Archery description when distilling a transmuted Acid Potion", () => {
    const aimed = getTransmutationVariants(cardById["acid-potion"]!, "archery", [])[0]!.result;
    for (const result of [strengthenPotion(aimed)!, doublePotionPotency(aimed)]) {
      expect(result.descriptionLines).toContain("Archery");
      expect(getCardKeywords(result)).toContain("archery");
      expect(hydrateCard(BattleCardSchema.parse(result))).toEqual(result);
    }
  });

  it("keeps native Archery mechanics when mixing a transmuted Potion, including identical effects", () => {
    const acid = cardById["acid-potion"]!;
    const aimed = getTransmutationVariants(acid, "archery", [])[0]!.result;
    for (const other of [acid, cardById["health-potion"]!]) {
      for (const ingredients of [
        [aimed, other],
        [other, aimed],
      ] as const) {
        const result = createMixedPotion(...ingredients);
        expect(getCardKeywords(result)).toContain("archery");
        expect(result.descriptionLines.filter((line) => line === "Archery")).toHaveLength(1);
        expect(hydrateCard(BattleCardSchema.parse(result))).toEqual(result);
      }
    }
  });

  it("checks the generated effect-line limit when Leech expands repeated damage descriptions", () => {
    const source = card(Array.from({ length: 6 }, () => ({ kind: "damage", damageType: "physical", amount: 1 })));
    expect(source.description!.filter((line) => line.role === "effect")).toHaveLength(3);
    expect(getTransmutationVariants(source, "leech", [source])).toEqual([]);
    expect(getTransmutationVariants(source, "archery", [source])).toHaveLength(1);
  });

  it("converts every matching damage occurrence through branches and repeats without changing numbers or costs", () => {
    const source = card([
      { kind: "damage", damageType: "physical", amount: 4, ignoreArmor: true },
      {
        kind: "chance",
        probability: 0.25,
        successEffects: [{ kind: "damage", damageType: "physical", amount: 7 }],
        failureEffects: [{ kind: "damage", damageType: "bleed", amount: 2 }],
      },
      {
        kind: "repeat-over-turns",
        remainingTurns: 3,
        effects: [{ kind: "damage", damageType: "physical", amount: 4 }],
      },
    ]);
    const before = structuredClone(source);
    const variants = getTransmutationVariants(source, "burn", [source]);
    expect(variants.map((entry) => entry.sourceKeyword)).toEqual(["physical", "bleed"]);
    const result = variants[0]!.result;
    expect(result).toMatchObject({
      id: source.id,
      uid: 17,
      cost: source.cost,
      art: source.art,
      title: "Burning Slash",
      transmuted: "burn",
    });
    expect(result.effects).toEqual([
      { kind: "damage", damageType: "burn", amount: 4, ignoreArmor: true },
      {
        kind: "chance",
        probability: 0.25,
        successEffects: [{ kind: "damage", damageType: "burn", amount: 7 }],
        failureEffects: [{ kind: "damage", damageType: "bleed", amount: 2 }],
      },
      { kind: "repeat-over-turns", remainingTurns: 3, effects: [{ kind: "damage", damageType: "burn", amount: 4 }] },
    ]);
    expect(numericFields(result.effects)).toEqual(numericFields(source.effects));
    expect(source).toEqual(before);
  });

  it("excludes conversions that would leave conditions, scaling, or linked effects inconsistent", () => {
    for (const id of ["kindling", "combustion", "poison-dagger"]) {
      const source = cardById[id]!;
      expect(getTransmutationVariants(source, "freeze", [source])).toEqual([]);
      expect(getTransmutationVariants(source, "wish", [source])).toHaveLength(1);
    }
    const source = card([
      { kind: "damage", damageType: "physical", amount: 4 },
      { kind: "damage", damageType: "holy", amount: 0, equalToBlock: true },
      { kind: "player-status", status: "block", amount: 5 },
    ]);
    expect(getTransmutationVariants(source, "armor", [source])).toEqual([]);
    expect(getTransmutationVariants(card([{ kind: "damage", damageType: "physical", amount: 0 }]), "burn", [])).toEqual(
      [],
    );
  });

  it("converts unconditional Mana restoration while preserving a real Freeze condition", () => {
    const source = card([{ kind: "restore-mana", amount: 2, ifEnemyFrozen: false }]);
    expect(getTransmutationVariants(source, "gold", [source])[0]?.result.effects).toEqual([
      { kind: "gain-gold", amount: 2 },
    ]);
    const conditional = card([{ kind: "restore-mana", amount: 2, ifEnemyFrozen: true }]);
    expect(getTransmutationVariants(conditional, "gold", [conditional])).toEqual([]);
  });

  it("converts positive resources and buffs but preserves Health costs and permanent Mana changes", () => {
    const source = card([
      { kind: "heal", amount: 8 },
      { kind: "lose-health", amount: 2 },
      { kind: "gain-max-mana", amount: 1 },
    ]);
    expect(getTransmutationVariants(source, "gold", [source])[0]!.result.effects).toEqual([
      { kind: "gain-gold", amount: 8 },
      { kind: "lose-health", amount: 2 },
      { kind: "gain-max-mana", amount: 1 },
    ]);
    expect(getTransmutationVariants(cardById.block!, "forge", [])[0]!.result.effects).toEqual([
      { kind: "player-status", status: "forge", amount: 5 },
    ]);
  });

  it("preserves distilled magnitude marks when resource kinds change", () => {
    const source = card([{ kind: "heal", amount: 9 }]);
    for (const part of source.description!.flatMap((line) => line.parts))
      if (typeof part !== "string") part.distilled = true;
    const result = getTransmutationVariants(source, "mana", [source])[0]!.result;
    expect(result.description!.flatMap((line) => line.parts).filter((part) => typeof part !== "string")).toEqual([
      expect.objectContaining({
        distilled: true,
        references: [expect.objectContaining({ kind: "restore-mana", field: "amount" })],
      }),
    ]);
    expect(hydrateCard(BattleCardSchema.parse(result))).toEqual(result);
  });

  it("adds native keyword mechanics without changing existing magnitudes and requires a summon for Companion", () => {
    const slash = cardById.slash!;
    for (const keyword of ["wish", "dodge", "companion", "leech", "archery", "consume"] as const) {
      const result = getTransmutationVariants(slash, keyword, [slash, cardById["wolf-companion"]!])[0]!.result;
      expect(result.effects[0]).toMatchObject({ kind: "damage", damageType: "physical", amount: 4 });
      expect(getCardKeywords(result)).toContain(keyword);
      expect(result.title).toBe(`${TRANSMUTATION_PREFIXES[keyword]} Slash`);
      expect(hydrateCard(BattleCardSchema.parse(result))).toEqual(result);
    }
    expect(getTransmutationVariants(slash, "companion", [slash])).toEqual([]);
    expect(getTransmutationVariants(cardById.heal!, "archery", [])).toEqual([]);
    expect(getTransmutationVariants(slash, "wish", [slash])[0]!.result.effects.at(-1)).toEqual({
      kind: "wish",
      amount: 1,
    });
    expect(
      getTransmutationVariants(slash, "companion", [cardById["wolf-companion"]!])[0]!.result.effects.at(-1),
    ).toEqual({ kind: "companion-action", amount: 1 });
  });

  it("excludes duplicate keywords, Corruption, Mixed Potions, and repeat Transmutation in both directions", () => {
    const burning = getTransmutationVariants(cardById.slash!, "burn", [])[0]!.result;
    expect(isTransmutableCard(burning)).toBe(false);
    expect(corruptCard(burning, cardLibrary, createSeededRng(2))).toBeNull();
    for (const source of [{ ...cardById.slash!, corrupted: true }, cardById["mixed-potion"]!, burning])
      expect(getTransmutationVariants(source, "wish", [source])).toEqual([]);
    expect(getTransmutationVariants(cardById["burning-blade"]!, "burn", [])).toEqual([]);
    expect(getTransmutationVariants(cardById["wishing-well"]!, "wish", [])).toEqual([]);
    expect(getTransmutationVariants(cardById["pack-tactics"]!, "wish", [])).toEqual([]);
    const full = card(Array.from({ length: 4 }, () => ({ kind: "heal", amount: 1 })));
    expect(getTransmutationVariants(full, "wish", [])).toEqual([]);
  });

  it("rolls one useful keyword per bucket and fixes randomly chosen source types deterministically", () => {
    const source = card([
      { kind: "damage", damageType: "physical", amount: 4 },
      { kind: "damage", damageType: "bleed", amount: 2 },
      { kind: "player-status", status: "block", amount: 5 },
      { kind: "heal", amount: 2 },
    ]);
    const observed = new Set<KeywordId>();
    for (let seed = 0; seed < 30; seed++) {
      const choices = createTransmutationOffers([source], createSeededRng(seed));
      expect(choices).toEqual(createTransmutationOffers([source], createSeededRng(seed)));
      expect(choices).toHaveLength(3);
      choices.forEach((choice, index) => {
        expect(TRANSMUTATION_KEYWORD_GROUPS[index]).toContain(choice.keyword);
        expect(choice.alterations).toHaveLength(1);
        expect(getCardKeywords(choice.alterations[0]!.result)).toContain(choice.keyword);
      });
      observed.add(choices[0]!.alterations[0]!.sourceKeyword!);
    }
    expect(observed).toEqual(new Set(["physical", "bleed"]));
  });

  it("fills missing buckets without duplicates and allows empty visits", () => {
    const offers = createTransmutationOffers([cardById.heal!], createSeededRng(2));
    expect(offers).toHaveLength(3);
    expect(new Set(offers.map((offer) => offer.keyword)).size).toBe(3);
    expect(offers.every((offer) => offer.alterations.length)).toBe(true);
    expect(createTransmutationOffers([{ ...cardById.slash!, corrupted: true }], createSeededRng(2))).toEqual([]);
  });

  it("keeps all catalog conversion values and added mechanics through validation and hydration without mutating definitions", () => {
    const before = cardLibrary.map(cloneBattleCard);
    const reached = new Set<KeywordId>();
    for (const keyword of Object.keys(TRANSMUTATION_PREFIXES) as KeywordId[]) {
      for (const source of cardLibrary) {
        for (const { result } of getTransmutationVariants(source, keyword, cardLibrary)) {
          reached.add(keyword);
          expect(numericFields(result.effects)).toMatchObject(numericFields(source.effects));
          expect(hydrateCard(BattleCardSchema.parse(result))).toEqual(result);
        }
      }
    }
    expect(reached.size).toBe(21);
    expect(cardLibrary).toEqual(before);
  });
});
