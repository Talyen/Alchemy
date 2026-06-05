import { describe, expect, it, vi } from "vitest";
import type { MysteryEffect } from "@/features/alchemy/run-loop/mystery-events";
import { applyMysteryEffect } from "@/features/alchemy/run-loop/navigation/mystery-flow";

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
});
