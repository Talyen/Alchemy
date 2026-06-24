import { describe, expect, it, vi } from "vitest";
import type { MysteryEffect } from "@/lib/mystery";
import { applyMysteryEffect } from "@/features/alchemy/run-loop/navigation/mystery-flow";
import { cardLibrary, getCardKeywords, type BattleCard } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import * as cardPools from "@/lib/game-data/cards/card-pools";

vi.mock("@/features/alchemy/shared/stores/app-store", () => ({
  useAppStore: {
    getState: () => ({
      setDiscoveredCardIds: vi.fn(),
      setDiscoveredTrinketIds: vi.fn(),
    }),
  },
}));

function minimalContext(overrides: { runDeck?: BattleCard[] } = {}) {
  return {
    runDeck: overrides.runDeck,
    runMaxHealth: 30,
    rng: vi.fn(() => 0.5),
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

describe("applyMysteryEffect", () => {
  it("dispatches each mystery effect kind to the expected run mutation", () => {
    const slash = cardLibrary.find((card) => card.id === "slash")!;

    const addCardContext = minimalContext();
    applyMysteryEffect({ kind: "addCard", cardId: "slash" }, addCardContext);
    expect(addCardContext.setRunDeck).toHaveBeenCalledOnce();

    const chooseContext = minimalContext();
    const chooseResult = applyMysteryEffect({ kind: "chooseCard" }, chooseContext);
    expect(chooseContext.setMysteryCardChoices).toHaveBeenCalledOnce();
    expect(chooseResult.followUp).toBe("choose-card");

    const healContext = minimalContext();
    applyMysteryEffect({ kind: "healHealth", amount: 5 }, healContext);
    const healUpdater = healContext.setRunPlayerHealth.mock.calls[0][0];
    expect(healUpdater(20)).toBe(25);

    const damageContext = minimalContext();
    applyMysteryEffect({ kind: "damageHealth", amount: 3 }, damageContext);
    const damageUpdater = damageContext.setRunPlayerHealth.mock.calls[0][0];
    expect(damageUpdater(20)).toBe(17);

    const gainGoldContext = minimalContext();
    applyMysteryEffect({ kind: "gainGold", amount: 10 }, gainGoldContext);
    expect(gainGoldContext.onAwardGold).toHaveBeenCalledWith(10);

    const loseGoldContext = minimalContext();
    applyMysteryEffect({ kind: "loseGold", amount: 5 }, loseGoldContext);
    const goldUpdater = loseGoldContext.setRunGold.mock.calls[0][0];
    expect(goldUpdater(20)).toBe(15);

    const gainXpContext = minimalContext();
    applyMysteryEffect({ kind: "gainXP", keyword: "physical", amount: 1 }, gainXpContext);
    expect(gainXpContext.awardMysteryXP).toHaveBeenCalledWith("physical", 1);

    const removeContext = minimalContext({ runDeck: [slash] });
    applyMysteryEffect({ kind: "removeCard", mode: "random" }, removeContext);
    expect(removeContext.setRunDeck).toHaveBeenCalledOnce();

    const trinketContext = minimalContext();
    applyMysteryEffect({ kind: "gainTrinket", trinketId: "bone-charm" }, trinketContext);
    expect(trinketContext.setRunTrinkets).toHaveBeenCalledOnce();

    const randomTrinketContext = minimalContext();
    applyMysteryEffect({ kind: "gainRandomTrinket" }, randomTrinketContext);
    expect(randomTrinketContext.setRunTrinkets).toHaveBeenCalledOnce();

    const materialContext = minimalContext();
    applyMysteryEffect({ kind: "gainMaterial", material: "wood", amount: 1 }, materialContext);
    expect(materialContext.onAddMaterials).toHaveBeenCalledWith(expect.objectContaining({ wood: 1 }));
  });

  it("throws for unknown effect kinds", () => {
    expect(() => applyMysteryEffect({ kind: "unknown-kind" } as unknown as MysteryEffect, minimalContext())).toThrow(
      /Unhandled mystery effect kind/,
    );
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
      if (offered.some((card: BattleCard) => !getCardKeywords(card).includes("archery"))) {
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

    const poolSpy = vi.spyOn(cardPools, "getOfferableCardPool").mockReturnValue(slashOnly);
    try {
      const context = minimalContext();
      applyMysteryEffect({ kind: "chooseCard", tag: "archery" }, context);

      expect(context.setMysteryCardChoices).toHaveBeenCalledTimes(1);
      const offered = context.setMysteryCardChoices.mock.calls[0][0];
      expect(offered.length).toBeGreaterThan(0);
      expect(offered.every((card: BattleCard) => card.id === "slash")).toBe(true);
    } finally {
      poolSpy.mockRestore();
    }
  });
});
