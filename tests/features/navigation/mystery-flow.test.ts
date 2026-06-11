import { describe, expect, it, vi } from "vitest";
import type { MysteryEffect } from "@/features/alchemy/run-loop/mystery-events";
import { applyMysteryEffect } from "@/features/alchemy/run-loop/navigation/mystery-flow";
import * as gameData from "@/lib/game-data";
import { cardLibrary, getCardKeywords, getOfferableCardPool } from "@/lib/game-data";

const MYSTERY_EFFECT_KINDS: MysteryEffect["kind"][] = [
  "addCard",
  "chooseCard",
  "healHealth",
  "damageHealth",
  "gainGold",
  "loseGold",
  "gainXP",
  "removeCard",
  "gainTrinket",
  "gainRandomTrinket",
  "gainMaterial",
  "none",
];

function minimalContext() {
  return {
    runMaxHealth: 30,
    setRunDeck: vi.fn(),
    setRunGold: vi.fn(),
    setRunPlayerHealth: vi.fn(),
    setRunTrinkets: vi.fn(),
    setMysteryCardChoices: vi.fn(),
    awardMysteryXP: vi.fn(),
    onAddMaterials: vi.fn(),
    onAwardGold: vi.fn(),
  };
}

const effectsByKind: Record<MysteryEffect["kind"], MysteryEffect> = {
  addCard: { kind: "addCard", cardId: "slash" },
  chooseCard: { kind: "chooseCard" },
  healHealth: { kind: "healHealth", amount: 5 },
  damageHealth: { kind: "damageHealth", amount: 3 },
  gainGold: { kind: "gainGold", amount: 10 },
  loseGold: { kind: "loseGold", amount: 5 },
  gainXP: { kind: "gainXP", keyword: "physical", amount: 1 },
  removeCard: { kind: "removeCard", mode: "random" },
  gainTrinket: { kind: "gainTrinket", trinketId: "bone-charm" },
  gainRandomTrinket: { kind: "gainRandomTrinket" },
  gainMaterial: { kind: "gainMaterial", material: "wood", amount: 1 },
  none: { kind: "none" },
};

describe("applyMysteryEffect", () => {
  it("dispatches every declared mystery effect kind", () => {
    const context = minimalContext();

    for (const kind of MYSTERY_EFFECT_KINDS) {
      expect(() => applyMysteryEffect(effectsByKind[kind], context)).not.toThrow();
    }
  });

  it("throws for unknown effect kinds", () => {
    expect(() =>
      applyMysteryEffect({ kind: "unknown-kind" } as MysteryEffect, minimalContext()),
    ).toThrow(/Unhandled mystery effect kind/);
  });

  it("chooseCard with archery tag offers only archery-tagged cards", () => {
    const context = minimalContext();
    applyMysteryEffect({ kind: "chooseCard", tag: "archery" }, context);

    expect(context.setMysteryCardChoices).toHaveBeenCalledTimes(1);
    const offered = context.setMysteryCardChoices.mock.calls[0][0];
    expect(offered.length).toBeGreaterThan(0);
    for (const card of offered) {
      const libraryCard = cardLibrary.find((c) => c.id === card.id);
      expect(getCardKeywords(libraryCard ?? card)).toContain("archery");
    }
  });

  it("chooseCard without tag can offer non-archery cards", () => {
    let sawNonArchery = false;
    for (let i = 0; i < 30; i++) {
      const context = minimalContext();
      applyMysteryEffect({ kind: "chooseCard" }, context);
      const offered = context.setMysteryCardChoices.mock.calls[0][0];
      if (offered.some((card) => !getCardKeywords(card).includes("archery"))) {
        sawNonArchery = true;
        break;
      }
    }
    expect(sawNonArchery).toBe(true);
  });

  it("chooseCard with unmatched tag falls back to the full offerable pool", () => {
    const slashOnly = getOfferableCardPool().filter((card) => card.id === "slash");
    expect(slashOnly).toHaveLength(1);
    expect(getCardKeywords(slashOnly[0])).not.toContain("archery");

    const poolSpy = vi.spyOn(gameData, "getOfferableCardPool").mockReturnValue(slashOnly);
    try {
      const context = minimalContext();
      applyMysteryEffect({ kind: "chooseCard", tag: "archery" }, context);

      expect(context.setMysteryCardChoices).toHaveBeenCalledTimes(1);
      const offered = context.setMysteryCardChoices.mock.calls[0][0];
      expect(offered.length).toBeGreaterThan(0);
      expect(offered.every((card) => card.id === "slash")).toBe(true);
    } finally {
      poolSpy.mockRestore();
    }
  });
});
