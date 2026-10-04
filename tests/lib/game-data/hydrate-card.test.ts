import { describe, expect, it } from "vitest";
import { cardById, type BattleCard } from "@/lib/game-data";
import { cloneBattleCard, hydrateCard } from "@/lib/game-data/cards/hydrate-card";
import { BattleCardSchema } from "@/lib/validation/save-schemas/battle-card-schemas";

const libraryCard = cardById["molten-bulwark"]!;
const modifiedCard: BattleCard = {
  ...libraryCard,
  title: "Old title",
  art: "old-art",
  cost: 0,
  consume: false,
  uid: 42,
  effects: [{ kind: "player-status", status: "block", amount: 9 }, libraryCard.effects[1]!],
  descriptionLines: ["Gain 9 Block", libraryCard.descriptionLines[1]!],
  corrupted: true,
  baseTitle: libraryCard.title,
  corruptedValuePositions: [{ lineIndex: 0, matchIndex: 5 }],
};

describe("saved card content restoration", () => {
  it("treats inherited object keys as unknown cards during hydration", () => {
    const invalid = BattleCardSchema.parse({ id: "toString" });
    expect(hydrateCard(invalid)).toBe(invalid);
  });

  it("does not add catalog Consume to a complete reusable saved Roll the Dice", () => {
    const legacy: BattleCard = {
      ...cardById["roll-the-dice"]!,
      descriptionLines: ["Deal 3 Random damage or gain 3 Gold"],
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "random-damage", minAmount: 3, maxAmount: 3 }],
          failureEffects: [{ kind: "gain-gold", amount: 3 }],
        },
      ],
    };
    delete legacy.consume;
    const restored = hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(legacy))));
    expect(restored).toEqual(legacy);
    expect(restored.consume).toBeUndefined();
    expect(hydrateCard(restored)).toEqual(restored);
    expect(hydrateCard({ ...legacy, effects: [] }).consume).toBe(true);
  });

  it.each([
    ["one invalid effect", { effects: [modifiedCard.effects[0], { kind: "missing-effect" }] }],
    [
      "invalid nested effect",
      {
        effects: [
          { kind: "chance", probability: 0.5, successEffects: [{ kind: "missing-effect" }], failureEffects: [] },
        ],
      },
    ],
    ["missing effects", { effects: undefined }],
    ["empty effects", { effects: [] }],
    ["non-array effects", { effects: "invalid" }],
    ["missing description", { descriptionLines: undefined }],
    ["empty description", { descriptionLines: [] }],
    ["non-string description", { descriptionLines: [123] }],
    ["non-array description", { descriptionLines: "invalid" }],
  ])("recovers effects and prose together for %s", (_label, overrides) => {
    const validated = BattleCardSchema.parse({ ...modifiedCard, ...overrides });
    const restored = hydrateCard(validated);

    expect(restored).toEqual({ ...libraryCard, cost: 0, consume: false, uid: 42 });
    expect(hydrateCard(restored)).toEqual(restored);
    expect(hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(validated))))).toEqual(restored);
  });

  it.each([false, true])("preserves complete saved content when corrupted is %s", (corrupted) => {
    const saved = { ...modifiedCard, corrupted };
    expect(hydrateCard(BattleCardSchema.parse(saved))).toEqual({
      ...saved,
      title: libraryCard.title,
      art: libraryCard.art,
    });
  });

  it.each(["fewer", "more"])("preserves valid saved effects and matching prose with %s effects", (size) => {
    const saved: BattleCard = {
      ...modifiedCard,
      effects: size === "fewer" ? [modifiedCard.effects[0]!] : [...modifiedCard.effects, { kind: "heal", amount: 2 }],
      descriptionLines: size === "fewer" ? ["Gain 9 Block"] : [...modifiedCard.descriptionLines, "Restore 2 Health"],
    };
    const restored = hydrateCard(BattleCardSchema.parse(saved));
    expect(restored.effects).toEqual(saved.effects);
    expect(restored.descriptionLines).toEqual(saved.descriptionLines);
    expect(restored.corruptedValuePositions).toEqual(saved.corruptedValuePositions);
  });

  it("recovers incomplete typed cards without requiring another validation pass", () => {
    expect(hydrateCard({ ...modifiedCard, descriptionLines: [] })).toEqual({
      ...libraryCard,
      cost: 0,
      consume: false,
      uid: 42,
    });
  });

  it("preserves nested effects without sharing recursive effect objects", () => {
    const saved: BattleCard = {
      ...libraryCard,
      effects: [
        {
          kind: "chance",
          probability: 0.5,
          successEffects: [{ kind: "repeat-over-turns", remainingTurns: 2, effects: [{ kind: "heal", amount: 3 }] }],
          failureEffects: [{ kind: "heal", amount: 1 }],
        },
      ],
      descriptionLines: ["Restore 3 Health for 2 turns or restore 1 Health"],
    };
    const before = structuredClone(saved);
    const libraryBefore = structuredClone(libraryCard);
    expect(hydrateCard(BattleCardSchema.parse(JSON.parse(JSON.stringify(saved))))).toEqual(saved);
    const restored = hydrateCard(saved);
    expect(restored.effects).toEqual(saved.effects);
    const effect = restored.effects[0];
    if (effect?.kind !== "chance") throw new Error("Expected chance effect");
    const repeated = effect.successEffects[0];
    if (repeated?.kind !== "repeat-over-turns") throw new Error("Expected repeated effect");
    repeated.effects.push({ kind: "heal", amount: 10 });
    effect.failureEffects.push({ kind: "heal", amount: 20 });
    restored.descriptionLines.push("Changed");
    expect(saved).toEqual(before);
    expect(libraryCard).toEqual(libraryBefore);
  });

  it("retains catalog fallback for invalid costs and explicit Consume overrides", () => {
    const consumable = cardById["health-potion"]!;
    expect(hydrateCard(BattleCardSchema.parse({ ...consumable, cost: -1, consume: false }))).toEqual({
      ...consumable,
      consume: false,
    });
  });

  it("retains the saved damage bypass fields", () => {
    const stab = cardById.stab!;
    const saved: BattleCard = {
      ...stab,
      effects: [{ kind: "damage", damageType: "physical", amount: 3, ignoreArmor: true, ignoreBlock: true }],
      descriptionLines: ["Deal 3 Physical damage", "Ignores Armor and Block"],
    };
    const restored = hydrateCard(saved);
    expect(restored.effects).toEqual(saved.effects);
  });
});

describe("card copy isolation", () => {
  it.each([
    { name: "run cloning", copyCard: cloneBattleCard },
    { name: "save restoration", copyCard: hydrateCard },
  ])("isolates nested effects and card fields through $name", ({ copyCard }) => {
    const source: BattleCard = {
      ...cardById["slash"]!,
      tags: ["poison"],
      corrupted: true,
      corruptedValuePositions: [{ lineIndex: 0, matchIndex: 5 }],
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
    const clone = copyCard(source);
    expect(clone.effects).toEqual(source.effects);
    expect(clone.descriptionLines).toEqual(source.descriptionLines);
    if (copyCard === cloneBattleCard) expect(clone.tags).toEqual(source.tags);
    const cloneChance = clone.effects[0];
    if (cloneChance?.kind !== "chance") throw new Error("Expected chance effect");
    const cloneRepeat = cloneChance.successEffects[0];
    if (cloneRepeat?.kind !== "repeat-over-turns") throw new Error("Expected repeated effect");
    const cloneDamage = cloneRepeat.effects[0];
    if (cloneDamage?.kind !== "damage") throw new Error("Expected damage effect");
    cloneDamage.amount = 99;
    cloneDamage.damageTypePool!.push("nature");
    const randomDamage = cloneRepeat.effects[1];
    const status = cloneRepeat.effects[2];
    if (randomDamage?.kind !== "random-damage" || status?.kind !== "player-status")
      throw new Error("Expected pooled effects");
    randomDamage.damageTypePool!.push("nature");
    status.statusPool!.push("thorns");
    cloneChance.failureEffects.push({ kind: "heal", amount: 99 });
    clone.descriptionLines.push("Changed");
    clone.tags?.push("burn");
    clone.corruptedValuePositions![0]!.lineIndex = 99;
    expect(source).toEqual(before);
  });
});
