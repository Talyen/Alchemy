import { expect, it } from "vitest";
import {
  getOfferableCardPool,
  getStandardPotionPool,
  isPotionCard,
  isStandardPotionCard,
} from "@/lib/game-data/cards/card-pools";

it("keeps the brewing pool limited to the seven Distillation-eligible standard Potions", () => {
  const pool = getStandardPotionPool();
  expect(pool.map((card) => card.id).sort()).toEqual([
    "acid-potion",
    "health-potion",
    "luck-potion",
    "mana-potion",
    "panacea-potion",
    "stoneskin-potion",
    "wishing-potion",
  ]);
  expect(pool.every((card) => isPotionCard(card) && isStandardPotionCard(card))).toBe(true);
});

it("applies Potion perks to Mixed Potions without allowing them to be brewed again", () => {
  for (const id of ["mixed-potion", "mixed-potion-health-potion-a1-mana-potion-b2"]) {
    expect(isPotionCard({ id })).toBe(true);
    expect(isStandardPotionCard({ id })).toBe(false);
  }
  for (const id of ["mana-berries", "mana-crystals", "apple", "bread", "brand-new-potion", "mixed-potionish"]) {
    expect(isPotionCard({ id })).toBe(false);
    expect(isStandardPotionCard({ id })).toBe(false);
  }
});

it("prevents callers from emptying the cached brewing and reward pools", () => {
  for (const getPool of [getStandardPotionPool, getOfferableCardPool]) {
    const expectedIds = getPool().map((card) => card.id);
    expect(expectedIds.length).toBeGreaterThan(0);
    getPool().splice(0);
    expect(getPool().map((card) => card.id)).toEqual(expectedIds);
  }
});
