import { describe, expect, it } from "vitest";
import { getMysteryEffectRank, sortMysteryEffectsByDisplayOrder } from "@/lib/mystery";
import type { MysteryEffect } from "@/lib/mystery";

describe("getMysteryEffectRank", () => {
  it("orders XP < portrait < gold < material", () => {
    const xp: MysteryEffect = { kind: "gainXP", keyword: "nature", amount: 8 };
    const gold: MysteryEffect = { kind: "gainGold", amount: 10 };
    const loseGold: MysteryEffect = { kind: "loseGold", amount: 5 };
    const mat: MysteryEffect = { kind: "gainMaterial", material: "herbs", amount: 2 };
    const card: MysteryEffect = { kind: "addCard", cardId: "test" };
    const trinket: MysteryEffect = { kind: "gainTrinket", trinketId: "test" };
    const gear: MysteryEffect = { kind: "gainGeneratedGear", baseItemId: "dagger" };

    expect(getMysteryEffectRank(xp)).toBe(0);
    expect(getMysteryEffectRank(gold)).toBe(2);
    expect(getMysteryEffectRank(loseGold)).toBe(2);
    expect(getMysteryEffectRank(mat)).toBe(3);
    expect(getMysteryEffectRank(card)).toBe(1);
    expect(getMysteryEffectRank(trinket)).toBe(1);
    expect(getMysteryEffectRank(gear)).toBe(1);
  });
});

describe("sortMysteryEffectsByDisplayOrder", () => {
  it("sorts mixed effects into display order and is stable within rank", () => {
    const portrait: MysteryEffect = { kind: "gainGeneratedGear", baseItemId: "dagger" };
    const xp: MysteryEffect = { kind: "gainXP", keyword: "mana", amount: 8 };
    const mat: MysteryEffect = { kind: "gainMaterial", material: "gems", amount: 3 };
    const gold: MysteryEffect = { kind: "gainGold", amount: 20 };

    const sorted = sortMysteryEffectsByDisplayOrder([portrait, mat, gold, xp]);
    expect(sorted.map((e) => e.kind)).toEqual(["gainXP", "gainGeneratedGear", "gainGold", "gainMaterial"]);
  });

  it("does not mutate input", () => {
    const xp: MysteryEffect = { kind: "gainXP", keyword: "burn", amount: 8 };
    const gear: MysteryEffect = { kind: "gainGeneratedGear", baseItemId: "staff" };
    const input: MysteryEffect[] = [gear, xp];
    const sorted = sortMysteryEffectsByDisplayOrder(input);
    expect(input.map((e) => e.kind)).toEqual(["gainGeneratedGear", "gainXP"]);
    expect(sorted.map((e) => e.kind)).toEqual(["gainXP", "gainGeneratedGear"]);
  });
});
