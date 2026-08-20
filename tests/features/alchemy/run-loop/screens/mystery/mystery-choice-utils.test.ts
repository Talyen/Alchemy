import { describe, expect, it } from "vitest";
import type { MysteryChoice } from "@/lib/mystery";
import {
  choiceOffersCardSelection,
  hasPositiveMysteryEffect,
} from "@/features/alchemy/run-loop/screens/mystery/mystery-choice-utils";

describe("hasPositiveMysteryEffect", () => {
  it("returns true for heal and reward effects", () => {
    expect(hasPositiveMysteryEffect([{ kind: "healHealth", amount: 5 }])).toBe(true);
    expect(hasPositiveMysteryEffect([{ kind: "gainGold", amount: 10 }])).toBe(true);
    expect(hasPositiveMysteryEffect([{ kind: "gainGeneratedGear", baseItemId: "dagger" }])).toBe(true);
  });

  it("returns false for purely negative effects", () => {
    expect(hasPositiveMysteryEffect([{ kind: "damageHealth", amount: 5 }])).toBe(false);
    expect(hasPositiveMysteryEffect([{ kind: "loseGold", amount: 5 }])).toBe(false);
  });
});

describe("choiceOffersCardSelection", () => {
  it("returns true when a choice includes chooseCard", () => {
    const choice: MysteryChoice = {
      label: "Pick",
      effects: [{ kind: "chooseCard" }],
    };
    expect(choiceOffersCardSelection(choice)).toBe(true);
  });

  it("returns false for non-picker effects", () => {
    const choice: MysteryChoice = {
      label: "Heal",
      effects: [{ kind: "healHealth", amount: 5 }],
    };
    expect(choiceOffersCardSelection(choice)).toBe(false);
  });
});
