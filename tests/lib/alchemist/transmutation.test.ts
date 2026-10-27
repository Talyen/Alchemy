import { isDeepStrictEqual } from "node:util";
import { expect, it } from "vitest";
import { applyCardEffects } from "@/lib/battle";
import { makeState } from "../../fixtures/battle";
import { defaultPlayerStatusValues } from "../../fixtures/default-battle-state";
import {
  cardById,
  cardLibrary,
  cloneBattleCard,
  getCardKeywords,
  isCompanionSummonCard,
  type KeywordId,
} from "@/lib/game-data";
import { createTransmutationOffers, canTransmuteCard, getTransmutationVariants } from "@/lib/alchemist/transmutation";
import { TRANSMUTATION_KEYWORD_GROUPS, TRANSMUTATION_PREFIXES } from "@/lib/game-constants";
import { createSeededRng } from "@/lib/rng";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { corruptCard } from "@/lib/corruption";
import { strengthenPotion } from "@/lib/alchemist/brewing";
import { createMixedPotion, doublePotionPotency } from "@/lib/alchemist";
import { chance, describedCard, repeated, roundTrip } from "./fixtures";
import { LABYRINTH_TRAITS, transmutationModifierKeyword } from "@/lib/content-systems/labyrinth/trait-catalog";
import { getRewardModifiersForNodeType, isLabyrinthTraitEligible } from "@/lib/content-systems/labyrinth/modifiers";
import { eligibleEncounterTraitIds } from "@/lib/content-systems/encounter-traits";
import { ActiveRunDataSchema } from "@/lib/validation/save-schemas/active-run";
import { hydrateAlchemyVisit } from "@/lib/active-run-session/alchemy-visits";

function numericFields(value: unknown, path = ""): Record<string, number> {
  if (!value || typeof value !== "object") return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([key, child]) =>
      typeof child === "number" ? [[`${path}/${key}`, child]] : Object.entries(numericFields(child, `${path}/${key}`)),
    ),
  );
}

it("Prismatic Crucible saves every compatible keyword and preserves a later selection through reload", () => {
  const deck = [cardById.slash!, cardById.heal!, { ...cardById.block!, corrupted: true }];
  const choices = createTransmutationOffers(deck, createSeededRng(2), ["prismatic-crucible"]);
  deck.forEach((card, sourceIndex) => {
    const expected = TRANSMUTATION_KEYWORD_GROUPS.flat().filter(
      (keyword) => getTransmutationVariants(card, keyword, deck).length,
    );
    expect(
      choices
        .filter((choice) => choice.alterations.some((entry) => entry.sourceIndex === sourceIndex))
        .map((choice) => choice.keyword)
        .sort(),
    ).toEqual(expected.sort());
  });
  const offered = choices.filter((choice) => choice.alterations.some((entry) => entry.sourceIndex === 0));
  expect(offered.length).toBeGreaterThan(3);
  const offerIndex = offered.length - 1;
  const visit = {
    offers: [],
    result: null,
    original: null,
    completed: false,
    transmutation: { choices, sourceIndex: 0, source: deck[0]!, keyword: offered[offerIndex]!.keyword, offerIndex },
  };
  const restored = ActiveRunDataSchema.parse(
    JSON.parse(
      JSON.stringify({
        characterId: "knight",
        runDeck: deck,
        runPlayerHealth: 30,
        runMaxHealth: 30,
        activity: { kind: "transmutation", data: visit },
      }),
    ),
  );
  expect(restored.activity.kind).toBe("transmutation");
  if (restored.activity.kind !== "transmutation") throw new Error("Lost visit");
  expect(hydrateAlchemyVisit(restored.activity.data)).toEqual(visit);
  expect(createTransmutationOffers(deck, createSeededRng(2), ["prismatic-crucible"])).toEqual(choices);
});

it("keyword crucibles guarantee each supported keyword without losing normal choices or offering invalid alterations", () => {
  const deck = [
    cardById.slash!,
    cardById.heal!,
    cardById.block!,
    describedCard([{ kind: "damage", damageType: "holy", amount: 4 }]),
    describedCard([{ kind: "gain-gold", amount: 4 }]),
    describedCard([{ kind: "player-status", status: "armor", amount: 4 }]),
    cardLibrary.find(isCompanionSummonCard)!,
  ];
  const pool = eligibleEncounterTraitIds("labyrinth", "reward").filter((id) =>
    isLabyrinthTraitEligible(id, "transmutation"),
  );
  expect(pool).toHaveLength(TRANSMUTATION_KEYWORD_GROUPS.flat().length + 1);
  expect(pool.flatMap((id) => transmutationModifierKeyword(id) ?? []).sort()).toEqual(
    [...TRANSMUTATION_KEYWORD_GROUPS.flat()].sort(),
  );
  for (const id of pool) {
    expect(LABYRINTH_TRAITS[id as keyof typeof LABYRINTH_TRAITS].labyrinthNodes).toEqual(["transmutation"]);
    const keyword = transmutationModifierKeyword(id);
    if (!keyword) continue;
    const choices = createTransmutationOffers(deck, createSeededRng(2), [id]);
    expect(choices.find((choice) => choice.keyword === keyword)?.alterations.length, keyword).toBeGreaterThan(0);
    deck.forEach((card, sourceIndex) => {
      const offered = choices.filter((choice) => choice.alterations.some((entry) => entry.sourceIndex === sourceIndex));
      const compatible = TRANSMUTATION_KEYWORD_GROUPS.flat().filter(
        (key) => getTransmutationVariants(card, key, deck).length,
      );
      expect(offered).toHaveLength(Math.min(3, compatible.length));
      expect(offered.some((choice) => choice.keyword === keyword)).toBe(compatible.includes(keyword));
      for (const choice of offered) {
        const alteration = choice.alterations.find((entry) => entry.sourceIndex === sourceIndex)!;
        expect(getTransmutationVariants(card, choice.keyword, deck)).toContainEqual({
          sourceKeyword: alteration.sourceKeyword,
          result: alteration.result,
        });
      }
    });
  }
  const starter = [cardById.slash!];
  const eligible = pool.filter((id) => {
    const keyword = transmutationModifierKeyword(id);
    return !keyword || starter.some((card) => getTransmutationVariants(card, keyword, starter).length);
  });
  expect(eligible).not.toContain("companion-crucible");
  expect(eligible).not.toContain("physical-crucible");
  expect(
    eligible.flatMap((_, index) =>
      getRewardModifiersForNodeType(() => (index + 0.5) / eligible.length, "transmutation", 1, starter),
    ),
  ).toEqual(eligible);
  expect(getRewardModifiersForNodeType(() => 0.5, "transmutation", 1, [])).toEqual(["prismatic-crucible"]);
});

it("infuses Archery damage without changing Exorcism's Health cost", () => {
  const source = cardById.exorcism!;
  const result = getTransmutationVariants(source, "archery", [source])[0]!.result;
  const state = makeState({ playerHealth: 20, playerStatuses: defaultPlayerStatusValues({ burn: 4 }) });
  const before = applyCardEffects(state, source, []);
  const after = applyCardEffects(
    { ...state, talentEffects: { ...state.talentEffects, archeryDamageWithoutBlock: 3 } },
    result,
    [],
  );
  expect(result.effects).toEqual(source.effects);
  expect(before.enemyHealth - after.enemyHealth).toBe(3);
  expect(after.playerHealth).toBe(before.playerHealth);
});

it.each(["gamblers-shot", "exorcism"])("adds working Leech to %s through restoration", (id) => {
  const source = cardById[id]!;
  const result = roundTrip(getTransmutationVariants(source, "leech", [source])[0]!.result);
  const state = makeState({
    playerHealth: 10,
    playerStatuses: defaultPlayerStatusValues({ burn: 4 }),
    rng: () => 0.99,
  });
  const before = applyCardEffects(state, source, []);
  const after = applyCardEffects(state, result, []);
  expect(after.enemyHealth).toBe(before.enemyHealth);
  expect(after.playerStatuses).toEqual(before.playerStatuses);
  expect(after.playerHealth - before.playerHealth).toBe(Math.round((state.enemyHealth - before.enemyHealth) / 2));
  expect(after.playerHealth).toBeGreaterThan(before.playerHealth);
});

it("keeps Archery through both distillation and mixing, including identical ingredients", () => {
  const acid = cardById["acid-potion"]!;
  const aimed = getTransmutationVariants(acid, "archery", [])[0]!.result;
  const results = [
    strengthenPotion(aimed)!,
    doublePotionPotency(aimed),
    ...[acid, cardById["health-potion"]!].flatMap((other) => [
      createMixedPotion(aimed, other),
      createMixedPotion(other, aimed),
    ]),
  ];
  for (const result of results) {
    expect(getCardKeywords(result)).toContain("archery");
    expect(result.descriptionLines.filter((line) => line === "Archery")).toHaveLength(1);
    expect(roundTrip(result)).toEqual(result);
  }
});

it("converts every matching occurrence through branches and repeats while preserving unrelated effects", () => {
  const physical = { kind: "damage", damageType: "physical", amount: 4, ignoreArmor: true } as const;
  const bleed = { kind: "damage", damageType: "bleed", amount: 2 } as const;
  const source = describedCard([physical, chance([physical], [bleed], 0.25), repeated([physical])], { uid: 17 });
  const result = getTransmutationVariants(source, "burn", [source])[0]!.result;
  const converted = { ...physical, damageType: "burn" } as const;
  expect(result.effects).toEqual([converted, chance([converted], [bleed], 0.25), repeated([converted])]);
  expect(result).toMatchObject({ id: source.id, uid: 17, cost: source.cost, art: source.art, title: "Burning Slash" });
  const random = getTransmutationVariants(cardById["gamblers-shot"]!, "burn", [])[1]!.result;
  expect(random.effects).toEqual([
    { kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["stun", "burn", "bleed"] },
  ]);
});

it("excludes conversions that would leave conditions or linked scaling inconsistent", () => {
  for (const id of ["kindling", "combustion", "poison-dagger"])
    expect(getTransmutationVariants(cardById[id]!, "freeze", [])).toEqual([]);
  const source = describedCard([
    { kind: "damage", damageType: "holy", amount: 0, equalToBlock: true },
    { kind: "player-status", status: "block", amount: 5 },
  ]);
  expect(getTransmutationVariants(source, "armor", [])).toEqual([]);
  expect(
    getTransmutationVariants(describedCard([{ kind: "damage", damageType: "physical", amount: 0 }]), "burn", []),
  ).toEqual([]);
});

it("converts positive resources while preserving costs, permanent Mana, and improvement marks", () => {
  const source = describedCard([
    { kind: "heal", amount: 8 },
    { kind: "lose-health", amount: 2 },
    { kind: "gain-max-mana", amount: 1 },
  ]);
  for (const part of source.description![0]!.parts) if (typeof part !== "string") part.distilled = true;
  const result = getTransmutationVariants(source, "gold", [source])[0]!.result;
  expect(result.effects).toEqual([{ kind: "gain-gold", amount: 8 }, ...source.effects.slice(1)]);
  expect(result.description![0]!.parts).toContainEqual(
    expect.objectContaining({
      distilled: true,
      references: [expect.objectContaining({ kind: "gain-gold", field: "amount" })],
    }),
  );
});

it("requires a summon for a Companion addition", () => {
  const slash = cardById.slash!;
  expect(getTransmutationVariants(slash, "companion", [slash])).toEqual([]);
  expect(getTransmutationVariants(slash, "companion", [cardById["wolf-companion"]!])[0]!.result.effects.at(-1)).toEqual(
    { kind: "companion-action", amount: 1 },
  );
});

it("does not offer Consume to summons that already leave the battle without Consume rewards", () => {
  const summon = cardById["wolf-companion"]!;
  expect(getTransmutationVariants(summon, "consume", [summon])).toEqual([]);
  expect(getTransmutationVariants(describedCard([chance([summon.effects[0]!], [])]), "consume", [])).toEqual([]);
  expect(getTransmutationVariants(cardById.slash!, "consume", [])).toHaveLength(1);
});

it("excludes existing destination keywords and repeat Transmutation or Corruption", () => {
  const slash = cardById.slash!;
  const burning = getTransmutationVariants(slash, "burn", [])[0]!.result;
  expect(corruptCard(burning, cardLibrary, createSeededRng(2))).toBeNull();
  for (const source of [{ ...slash, corrupted: true }, cardById["mixed-potion"]!, burning])
    expect(getTransmutationVariants(source, "wish", [source])).toEqual([]);
  for (const id of ["wishing-well", "pack-tactics"])
    expect(getTransmutationVariants(cardById[id]!, "wish", [])).toEqual([]);
  expect(getTransmutationVariants(cardById["burning-blade"]!, "burn", [])).toEqual([]);
  expect(
    getTransmutationVariants(describedCard(Array.from({ length: 4 }, () => ({ kind: "heal", amount: 1 }))), "wish", []),
  ).toEqual([]);
  const repeatedDamage = describedCard(
    Array.from({ length: 6 }, () => ({ kind: "damage", damageType: "physical", amount: 1 })),
  );
  expect(getTransmutationVariants(repeatedDamage, "leech", [])).toEqual([]);
  expect(getTransmutationVariants(repeatedDamage, "archery", [])).toHaveLength(1);
});

it("saves three valid, reproducible choices per card even when the visit needs more than three keywords", () => {
  const deck = [cardById.slash!, cardById.heal!, cardById.block!];
  const choices = createTransmutationOffers(deck, createSeededRng(2));
  expect(choices).toEqual(createTransmutationOffers(deck, createSeededRng(2)));
  expect(choices.length).toBeGreaterThan(3);
  expect(new Set(choices.map((choice) => choice.keyword)).size).toBe(choices.length);
  deck.forEach((card, sourceIndex) => {
    const offered = choices.filter((choice) => choice.alterations.some((entry) => entry.sourceIndex === sourceIndex));
    expect(offered).toHaveLength(3);
    for (const group of TRANSMUTATION_KEYWORD_GROUPS) {
      if (group.some((keyword) => getTransmutationVariants(card, keyword, deck).length > 0))
        expect(offered.some((choice) => (group as readonly KeywordId[]).includes(choice.keyword))).toBe(true);
    }
    for (const choice of offered) {
      const alteration = choice.alterations.find((entry) => entry.sourceIndex === sourceIndex)!;
      expect(alteration.source).toEqual(card);
      expect(getTransmutationVariants(card, choice.keyword, deck)).toContainEqual({
        sourceKeyword: alteration.sourceKeyword,
        result: alteration.result,
      });
    }
  });
  const fallback = createTransmutationOffers([cardById.heal!], createSeededRng(2));
  expect(new Set(fallback.map((choice) => choice.keyword)).size).toBe(3);
  expect(fallback.every((choice) => choice.alterations.length)).toBe(true);
  expect(createTransmutationOffers([{ ...cardById.slash!, corrupted: true }], createSeededRng(2))).toEqual([]);
});

it("skips ineligible cards without consuming random choices", () => {
  const original = [cardById.slash!, cardById.heal!];
  const withIneligible = [
    ...original,
    { ...cardById.block!, corrupted: true },
    { ...cardById.slash!, transmuted: true },
  ];
  const before = createSeededRng(123);
  const after = createSeededRng(123);
  expect(createTransmutationOffers(withIneligible, after)).toEqual(createTransmutationOffers(original, before));
  expect(after()).toBe(before());
});

it("matches saved sources across a save round-trip but rejects cost drift", () => {
  const deck = [cardById.slash!, cardById.heal!, cardById.block!];
  const choices = createTransmutationOffers(deck, createSeededRng(2));
  expect(choices.length).toBeGreaterThan(0);
  const reloaded = JSON.parse(JSON.stringify(choices)) as typeof choices;
  expect(canTransmuteCard(reloaded, cardById.slash!, 0)).toBe(true);
  expect(canTransmuteCard(reloaded, { ...cardById.slash!, cost: cardById.slash!.cost + 1 }, 0)).toBe(false);
});

it("preserves catalog magnitudes, mechanics and saved previews across all 21 keywords without mutating definitions", () => {
  const before = cardLibrary.map(cloneBattleCard);
  const sourceValues = new Map(cardLibrary.map((source) => [source, numericFields(source.effects)]));
  const reached = new Set<KeywordId>();
  const examples: string[] = [];
  let violations = 0;
  function fail(scenario: string) {
    violations++;
    if (examples.length < 10) examples.push(scenario);
  }
  for (const keyword of Object.keys(TRANSMUTATION_PREFIXES) as KeywordId[]) {
    for (const source of cardLibrary) {
      for (const { result } of getTransmutationVariants(source, keyword, cardLibrary)) {
        reached.add(keyword);
        const scenario = `${source.id} -> ${keyword}`;
        const values = numericFields(result.effects);
        if (!Object.entries(sourceValues.get(source)!).every(([path, value]) => values[path] === value))
          fail(`${scenario}: changed a magnitude`);
        if (!getCardKeywords(result).includes(keyword)) fail(`${scenario}: missing keyword`);
        const parsed = BattleCardSchema.safeParse(result);
        if (!parsed.success) fail(`${scenario}: invalid saved card: ${parsed.error.message}`);
        else if (!isDeepStrictEqual(hydrateCard(parsed.data), result)) fail(`${scenario}: hydration changed the card`);
      }
    }
  }
  expect({ violations, examples }).toEqual({ violations: 0, examples: [] });
  expect(reached.size).toBe(21);
  expect(cardLibrary).toEqual(before);
});
