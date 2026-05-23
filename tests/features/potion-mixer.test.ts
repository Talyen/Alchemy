// Unit tests for alchemist potion-combining logic.
import { describe, expect, it, vi } from "vitest";
import { createMixedPotion, tryCreateMixedPotion, applyMixToDeck } from "@/features/alchemy/potion-mixer";
import type { BattleCard } from "@/lib/game-data";

function makePotion(overrides: Partial<BattleCard> = {}): BattleCard {
  return {
    id: "health-potion",
    title: "Health Potion",
    descriptionLines: ["Heal 5 Health", "Consume"],
    art: "health-potion",
    cost: 2,
    consume: true,
    effects: [{ kind: "heal", amount: 5 }],
    ...overrides,
  };
}

const healPotion = makePotion();
const firePotion = makePotion({
  id: "fire-potion",
  title: "Fire Potion",
  descriptionLines: ["Deal 8 Burn damage", "Consume"],
  effects: [{ kind: "damage", damageType: "burn", amount: 8 }],
});

describe("createMixedPotion", () => {
  it("combines two different potions by concatenating their effects", () => {
    const mixed = createMixedPotion(healPotion, firePotion);

    expect(mixed.title).toBe("Mixed Potion");
    expect(mixed.consume).toBe(true);
    expect(mixed.effects).toHaveLength(2);
    expect(mixed.effects[0]).toEqual({ kind: "heal", amount: 5 });
    expect(mixed.effects[1]).toEqual({ kind: "damage", damageType: "burn", amount: 8 });
  });

  it("doubles effects when mixing the same potion ID", () => {
    const mixed = createMixedPotion(healPotion, healPotion);

    expect(mixed.effects).toHaveLength(1);
    expect(mixed.effects[0]).toEqual({ kind: "heal", amount: 10 });
  });

  it("doubles numeric description lines when mixing the same potion", () => {
    const mixed = createMixedPotion(healPotion, healPotion);

    expect(mixed.descriptionLines).toContain("Heal 10 Health");
    expect(mixed.descriptionLines).toContain("Consume");
  });

  it("deduplicates description lines when mixing different potions", () => {
    const mixed = createMixedPotion(healPotion, firePotion);

    expect(mixed.descriptionLines).toContain("Heal 5 Health");
    expect(mixed.descriptionLines).toContain("Deal 8 Burn damage");
    expect(mixed.descriptionLines).toContain("Consume");
    // Consume should appear exactly once
    expect(mixed.descriptionLines.filter((l) => l === "Consume")).toHaveLength(1);
  });

  it("throws when mixing with an existing Mixed Potion", () => {
    const mixedPotion = makePotion({
      id: "mixed-potion",
      title: "Mixed Potion",
    });

    expect(() => createMixedPotion(mixedPotion, healPotion)).toThrow("Cannot mix with an existing Mixed Potion");
    expect(() => createMixedPotion(healPotion, mixedPotion)).toThrow("Cannot mix with an existing Mixed Potion");
  });

  it("produces a unique id based on timestamp", () => {
    const now = Date.now();
    vi.spyOn(Date, "now").mockReturnValueOnce(now).mockReturnValueOnce(now + 1);
    const a = createMixedPotion(healPotion, firePotion);
    const b = createMixedPotion(healPotion, firePotion);
    expect(a.id).not.toBe(b.id);
    vi.restoreAllMocks();
  });
});

describe("tryCreateMixedPotion", () => {
  it("returns null if either input is undefined", () => {
    expect(tryCreateMixedPotion(undefined, healPotion)).toBeNull();
    expect(tryCreateMixedPotion(healPotion, undefined)).toBeNull();
    expect(tryCreateMixedPotion(undefined, undefined)).toBeNull();
  });

  it("returns null instead of throwing when mixing with a Mixed Potion", () => {
    const mixedPotion = makePotion({ id: "mixed-potion" });
    const result = tryCreateMixedPotion(healPotion, mixedPotion);
    expect(result).toBeNull();
  });

  it("returns the mixed potion on success", () => {
    const result = tryCreateMixedPotion(healPotion, firePotion);
    expect(result).not.toBeNull();
    expect(result!.effects).toHaveLength(2);
  });
});

describe("applyMixToDeck", () => {
  const potionA = makePotion({ id: "a" });
  const potionB = makePotion({ id: "b" });
  const potionC = makePotion({ id: "c" });
  const mixed = createMixedPotion(potionA, potionB);

  it("removes the two potions at given indices and appends the mixed potion", () => {
    const deck = [potionA, potionB, potionC];
    const result = applyMixToDeck(deck, 0, 1, mixed);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("c");
    expect(result[1].id).toBe(mixed.id);
  });

  it("handles indices in any order (higher index first)", () => {
    const deck = [potionA, potionB, potionC];
    const result = applyMixToDeck(deck, 2, 0, mixed);

    expect(result).toHaveLength(2);
    expect(result[0].id).toBe("b");
    expect(result[1].id).toBe(mixed.id);
  });

  it("does not mutate the original deck array", () => {
    const deck = [potionA, potionB, potionC];
    const copy = [...deck];
    applyMixToDeck(deck, 0, 1, mixed);
    expect(deck).toEqual(copy);
  });
});
