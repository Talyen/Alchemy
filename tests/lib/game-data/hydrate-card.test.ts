import { describe, expect, it } from "vitest";
import { cardById, createEffectDescription, withCardDescription, type BattleCard } from "@/lib/game-data";
import { cloneBattleCard, hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";
import { normalizeSavedCardDefinition } from "@/lib/game-data/cards/normalize-saved-definition";
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
              { kind: "repeat-over-turns", remainingTurns: 1, effects: [] },
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
    if (effect.kind === "repeat-over-turns") effect.effects.push({ kind: "heal", amount: 1 });
  }
  wrapper.failureEffects.push({ kind: "heal", amount: 99 });
  result.descriptionLines.push("Changed");
  result.description![0]!.parts.push("Changed");
  result.tags!.push("burn");
  expect(source).toEqual(before);
});

describe("Shield Bash definition revision", () => {
  function previousBash(): BattleCard {
    const card = cloneBattleCard(cardById["shield-bash"]!);
    delete card.definitionVersion;
    const damage = card.effects[1]!;
    if (damage.kind !== "damage") throw new Error("Missing Bash damage");
    delete damage.spendBlock;
    return withCardDescription(card, createEffectDescription(card.effects));
  }

  it.each([true, false])("normalizes an ordinary existing card and persists its revision (bound=%s)", (bound) => {
    const saved = previousBash();
    if (!bound) delete saved.description;
    const before = JSON.stringify(saved);
    const restored = hydrateCard(BattleCardSchema.parse(JSON.parse(before)));
    expect(restored.definitionVersion).toBe(1);
    expect(restored.effects[1]).toMatchObject({ equalToBlockPercent: 50, spendBlock: true });
    expect(restored.descriptionLines).toEqual(["Gain 2 Block", "Spend half your Block to deal Stun damage"]);
    expect(hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(restored))))).toEqual(restored);
    expect(JSON.stringify(saved)).toBe(before);
  });

  it("changes only the old clause on a modified, transmuted card", () => {
    const original = previousBash();
    const saved = withCardDescription(
      {
        ...original,
        uid: 42,
        cost: 0,
        corrupted: true,
        transmuted: "holy",
        baseTitle: "Shield Bash",
        consume: true,
        tags: ["archery"],
        effects: [
          { kind: "player-status", status: "block", amount: 7 },
          {
            kind: "damage",
            damageType: "holy",
            amount: 0,
            equalToBlock: true,
            equalToBlockPercent: 50,
            lifesteal: true,
            ignoreArmor: true,
          },
          { kind: "heal", amount: 3 },
        ],
      },
      [],
    );
    saved.description = createEffectDescription(saved.effects);
    saved.description.push({ parts: ["Archery"], role: "keyword" }, { parts: ["Consume"], role: "consume" });
    const number = saved.description[0]!.parts.find((part) => typeof part !== "string");
    if (number && typeof number !== "string") number.corrupted = true;
    const complete = withCardDescription(saved, saved.description);
    const before = structuredClone(complete);
    const result = normalizeSavedCardDefinition(complete);
    expect(result.outcome).toBe("normalized");
    expect(result.card.effects).toEqual([
      before.effects[0],
      { ...before.effects[1], spendBlock: true },
      before.effects[2],
    ]);
    expect(result.card).toMatchObject({
      uid: 42,
      cost: 0,
      corrupted: true,
      transmuted: "holy",
      baseTitle: "Shield Bash",
      consume: true,
      tags: ["archery"],
    });
    expect(result.card.descriptionLines).toContain("Spend half your Block to deal Holy damage");
    expect(result.card.description![0]).toEqual(before.description![0]);
    expect(result.card.description!.slice(2)).toEqual(before.description!.slice(2));
    expect(complete).toEqual(before);
    expect(hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(result.card))))).toMatchObject({
      definitionVersion: 1,
      effects: result.card.effects,
    });
  });

  it("preserves a modified Chance wrapper and its unrelated failure branch", () => {
    const source = previousBash();
    const saved = withCardDescription(
      {
        ...source,
        corrupted: true,
        effects: [
          {
            kind: "chance",
            probability: 0.5,
            successEffects: source.effects,
            failureEffects: [{ kind: "heal", amount: 3 }],
          },
        ],
      },
      createEffectDescription([
        {
          kind: "chance",
          probability: 0.5,
          successEffects: source.effects,
          failureEffects: [{ kind: "heal", amount: 3 }],
        },
      ]),
    );
    const result = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(saved))));
    expect(result.effects[0]).toMatchObject({
      kind: "chance",
      probability: 0.5,
      successEffects: [{ kind: "player-status", amount: 2 }, { spendBlock: true }],
      failureEffects: [{ kind: "heal", amount: 3 }],
    });
    expect(result.descriptionLines.some((line) => line.includes("Spend half your Block"))).toBe(true);
    expect(hydrateCard(result)).toEqual(result);
  });

  it("stamps already-spending unversioned cards once and preserves newer revisions", () => {
    const saved = cloneBattleCard(cardById["shield-bash"]!);
    delete saved.definitionVersion;
    const restored = hydrateCard(saved);
    expect(restored).toEqual(cardById["shield-bash"]);
    expect(hydrateCard({ ...restored, definitionVersion: 2 }).definitionVersion).toBe(2);
  });

  it.each(["flat", "duplicate", "pool", "wording"])(
    "retains an ambiguous %s payload without falsely stamping it",
    (kind) => {
      let saved = previousBash();
      if (kind === "flat") saved.effects = [{ kind: "damage", damageType: "stun", amount: 2 }];
      if (kind === "duplicate") saved.effects.push({ ...saved.effects[1]! });
      if (kind === "pool") Object.assign(saved.effects[1]!, { damageTypePool: ["stun", "holy"] });
      if (kind === "wording") saved = { ...saved, description: undefined, descriptionLines: ["Custom unmatched rule"] };
      const result = normalizeSavedCardDefinition(saved);
      expect(result).toMatchObject({ outcome: "ambiguous", card: saved });
      expect(hydrateCard(saved).effects).toEqual(saved.effects);
      expect(hydrateCard(saved).definitionVersion).toBeUndefined();
    },
  );

  it("does not change unrelated non-spending scaling cards", () => {
    const saved = cloneBattleCard(cardById["blessed-aegis"]!);
    expect(hydrateCard(BattleCardSchema.parse(saved))).toEqual(saved);
  });
});
