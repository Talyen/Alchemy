import { expect, it } from "vitest";
import { cardById, type BattleCard } from "@/lib/game-data";
import { cloneBattleCard, hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { removeConsume } from "@/lib/corruption/card-edits";

const library = cardById["molten-bulwark"]!;
const { description: _description, ...unbound } = library;
const modified: BattleCard = {
  ...unbound,
  title: "Old title",
  art: "old-art",
  cost: 0,
  consume: false,
  uid: 42,
  effects: [{ kind: "player-status", status: "block", amount: 9 }, library.effects[1]!],
  descriptionLines: ["Gain 9 Block", library.descriptionLines[1]!],
  corrupted: true,
  baseTitle: library.title,
};

it("does not borrow catalog content for inherited object names", () => {
  const invalid = BattleCardSchema.parse({ id: "toString" });
  expect(hydrateCard(invalid)).toEqual(invalid);
});

it("preserves reusable saved Bread but recovers catalog Consume with incomplete content", () => {
  const saved = removeConsume(cardById.bread!);
  delete saved.consume;
  const restored = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(saved))));
  expect(restored).toEqual(saved);
  expect(hydrateCard(restored)).toEqual(restored);
  expect(hydrateCard({ ...saved, effects: [] }).consume).toBe(true);
});

it.each([
  { effects: [{ kind: "damage", damageType: "holy", amount: 2, retiredSelector: true }] },
  { effects: [modified.effects[0], { kind: "missing-effect" }] },
  { effects: [{ kind: "chance", probability: 0.5, successEffects: [{ kind: "missing-effect" }], failureEffects: [] }] },
  { effects: undefined },
  { effects: [] },
  { effects: "invalid" },
  { descriptionLines: undefined },
  { descriptionLines: [] },
  { descriptionLines: [123] },
  { descriptionLines: "invalid" },
])("recovers invalid effects and prose together: %j", (overrides) => {
  const restored = hydrateCard(BattleCardSchema.parse({ ...modified, ...overrides }));
  expect(restored).toEqual({ ...library, cost: 0, consume: false, uid: 42 });
  expect(hydrateCard(restored)).toEqual(restored);
});

it("preserves complete saved effects independently of Corruption while updating catalog presentation", () => {
  for (const corrupted of [false, true]) {
    const saved = { ...modified, corrupted };
    expect(hydrateCard(BattleCardSchema.parse(saved))).toEqual({ ...saved, title: library.title, art: library.art });
  }
  for (const effects of [[modified.effects[0]!], [...modified.effects, { kind: "heal", amount: 2 } as const]]) {
    const saved = { ...modified, effects, descriptionLines: effects.map(() => "Saved wording") };
    expect(hydrateCard(BattleCardSchema.parse(saved))).toEqual({ ...saved, title: library.title, art: library.art });
  }
  expect(hydrateCard({ ...modified, descriptionLines: [] })).toEqual({ ...library, cost: 0, consume: false, uid: 42 });
});

it("recovers invalid costs without losing explicit Consume overrides", () => {
  const source = cardById["health-potion"]!;
  expect(hydrateCard(BattleCardSchema.parse({ ...source, cost: -1, consume: false }))).toEqual({
    ...source,
    consume: false,
  });
});

it("preserves saved damage bypasses", () => {
  const stab = {
    ...cardById.stab!,
    effects: [{ kind: "damage", damageType: "physical", amount: 3, ignoreArmor: true, ignoreBlock: true } as const],
    descriptionLines: ["Deal 3 Physical damage", "Ignores Armor and Block"],
  };
  expect(hydrateCard(stab).effects).toEqual(stab.effects);
});

it.each([
  { name: "run cloning", copy: cloneBattleCard, id: "slash" },
  { name: "catalog restoration", copy: hydrateCard, id: "slash" },
  { name: "crafted restoration", copy: hydrateCard, id: "mixed-potion-crafted" },
])("$name owns nested effects, pools, tags, and descriptions", ({ copy, id }) => {
  const source: BattleCard = {
    ...cardById.slash!,
    id,
    tags: ["poison"],
    corrupted: true,
    effects: [
      {
        kind: "chance",
        probability: 0.5,
        successEffects: [
          {
            kind: "repeat-over-turns",
            remainingTurns: 1,
            effects: [
              { kind: "damage", damageType: "physical", damageTypePool: ["physical", "burn"], amount: 4 },
              { kind: "random-damage", minAmount: 1, maxAmount: 4, damageTypePool: ["holy", "freeze"] },
              { kind: "player-status", status: "block", statusPool: ["block", "forge"], amount: 5 },
            ],
          },
        ],
        failureEffects: [{ kind: "gain-gold", amount: 3 }],
      },
    ],
  };
  const before = structuredClone(source);
  const result = copy(source);
  expect(result.effects).toEqual(source.effects);
  expect(result.descriptionLines).toEqual(source.descriptionLines);
  expect(result.tags).toEqual(source.tags);
  const wrapper = result.effects[0] as Extract<BattleCard["effects"][number], { kind: "chance" }>;
  const repeat = wrapper.successEffects[0] as Extract<BattleCard["effects"][number], { kind: "repeat-over-turns" }>;
  for (const effect of repeat.effects) {
    Object.assign(effect, { amount: 99 });
    if ("damageTypePool" in effect) effect.damageTypePool!.push("nature");
    if (effect.kind === "player-status") effect.statusPool!.push("thorns");
  }
  wrapper.failureEffects.push({ kind: "heal", amount: 99 });
  result.descriptionLines.push("Changed");
  result.description![0]!.parts.push("Changed");
  result.tags!.push("burn");
  expect(source).toEqual(before);
});
