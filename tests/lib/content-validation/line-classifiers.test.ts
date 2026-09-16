import { describe, expect, it } from "vitest";
import {
  DIE_ROLL_LINE,
  RANDOM_DRAW_LINE,
  isBlockLine,
  isCleanseLine,
  isCompanionActionLine,
  isConvertManaBlockLine,
  isDieRollLine,
  isDoubleLine,
  isDrawLine,
  isGainMaxManaLine,
  isGainStatusLine,
  isGoldLine,
  isHealLine,
  isLoseHealthLine,
  isLoseMaxManaLine,
  isPerManaBlockLine,
  isRandomDrawLine,
  isRemoveEnemyArmorLine,
  isRemoveHarmfulStatusLine,
  isRestoreManaLine,
  isWishLine,
} from "@/lib/content-validation/card-parity/line-classifiers";

// Pins the shared card-line grammar: count parity and numeric parity must
// agree on what each line family looks like. If authored phrasing changes,
// update the classifier (once) rather than two parity files.
describe("card line classifiers", () => {
  it.each([
    ["Heal 5", true],
    ["Restore 4 Health", true],
    ["Gain 3 Health", true],
    ["Restore 4 Mana", false],
    ["Deal 5 damage", false],
  ])("isHealLine(%s) === %s", (line, expected) => {
    expect(isHealLine(line)).toBe(expected);
  });

  it.each([
    ["Restore 3 Mana", true],
    ["Gain 2 Mana", true],
    ["Restore 3 Mana and draw", true],
    ["Restore 4 Health", false],
    ["Gain 1 Mana Crystal", false],
    ["Gain 1 Maximum Mana", false],
    ["Deal 5 damage", false],
  ])("isRestoreManaLine(%s) === %s", (line, expected) => {
    expect(isRestoreManaLine(line)).toBe(expected);
  });

  it.each([
    ["Gain 10 Gold", true],
    ["Steal 5 Gold", true],
    ["gain 10 gold", true],
    ["Gain Gold", false],
    ["Gain 10 Mana", false],
  ])("isGoldLine(%s) === %s", (line, expected) => {
    expect(isGoldLine(line)).toBe(expected);
  });

  it.each([
    ["Wish for power", true],
    ["Gain 1 Mana", false],
  ])("isWishLine(%s) === %s", (line, expected) => {
    expect(isWishLine(line)).toBe(expected);
  });

  it.each([
    ["Remove 1 harmful status effect", true],
    ["Cleanse 2 harmful status effects", true],
    ["Cleanse 2 Poison", false],
  ])("isRemoveHarmfulStatusLine(%s) === %s", (line, expected) => {
    expect(isRemoveHarmfulStatusLine(line)).toBe(expected);
  });

  it.each([
    ["Lose 1 Mana Crystal", true],
    ["Gain 1 Mana Crystal", false],
  ])("isLoseMaxManaLine(%s) === %s", (line, expected) => {
    expect(isLoseMaxManaLine(line)).toBe(expected);
  });

  it.each([
    ["Gain 1 Maximum Mana", true],
    ["Gain 2 Mana Crystals", true],
    ["Gain 1 Mana Crystal", true],
    ["Gain 1 Mana", false],
    ["Lose 1 Mana Crystal", false],
  ])("isGainMaxManaLine(%s) === %s", (line, expected) => {
    expect(isGainMaxManaLine(line)).toBe(expected);
  });

  it.each([
    ["Lose 3 Health", true],
    ["Restore 4 Health", false],
  ])("isLoseHealthLine(%s) === %s", (line, expected) => {
    expect(isLoseHealthLine(line)).toBe(expected);
  });

  it("classifies draw and die-roll lines", () => {
    expect(isDrawLine("Draw 2")).toBe(true);
    expect(isDrawLine("Draw a card")).toBe(true);
    expect(isDrawLine(RANDOM_DRAW_LINE)).toBe(false);
    expect(isRandomDrawLine(RANDOM_DRAW_LINE)).toBe(true);
    expect(isRandomDrawLine("Draw 2")).toBe(false);
    expect(isDieRollLine(DIE_ROLL_LINE)).toBe(true);
    expect(isDieRollLine("Draw 2")).toBe(false);
  });

  it.each([
    ["Your Companion acts twice", true],
    ["Companion", false],
  ])("isCompanionActionLine(%s) === %s", (line, expected) => {
    expect(isCompanionActionLine(line)).toBe(expected);
  });

  it.each([
    ["Strip 2 enemy Armor", true],
    ["Remove 2 enemy Armor", true],
    ["Remove 1 harmful status effect", false],
  ])("isRemoveEnemyArmorLine(%s) === %s", (line, expected) => {
    expect(isRemoveEnemyArmorLine(line)).toBe(expected);
  });

  it.each([
    ["Double Poison", true],
    ["Deal 5 damage", false],
  ])("isDoubleLine(%s) === %s", (line, expected) => {
    expect(isDoubleLine(line)).toBe(expected);
  });

  it.each([
    ["Cleanse 2 Poison", true],
    ["Cleanse 1 harmful status effect", false],
  ])("isCleanseLine(%s) === %s", (line, expected) => {
    expect(isCleanseLine(line)).toBe(expected);
  });

  it.each([
    ["Gain 5 Block", true],
    ["Deal 5 damage or gain 3 Block", true],
    ["Gain 3 Block per Mana Crystal", false],
    ["Convert each of your Mana into Block", false],
    ["Gain 5 Block at the start of your next turn each turn", false],
  ])("isBlockLine(%s) === %s", (line, expected) => {
    expect(isBlockLine(line)).toBe(expected);
  });

  it.each([
    ["Convert each of your Mana into 5 Block", true],
    ["Gain 5 Block", false],
  ])("isConvertManaBlockLine(%s) === %s", (line, expected) => {
    expect(isConvertManaBlockLine(line)).toBe(expected);
  });

  it.each([
    ["Gain 3 Block per Mana Crystal", true],
    ["Gain 5 Block", false],
  ])("isPerManaBlockLine(%s) === %s", (line, expected) => {
    expect(isPerManaBlockLine(line)).toBe(expected);
  });

  it.each([
    ["Gain 5 Armor", "Armor", true],
    ["Gain 3 Forge", "Forge", true],
    ["Gain 2 Thorns", "Thorns", true],
    ["Gain 5 Block", "Armor", false],
  ])("isGainStatusLine(%s, %s) === %s", (line, name, expected) => {
    expect(isGainStatusLine(line, name)).toBe(expected);
  });
});
