import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MysteryEffect } from "@/lib/mystery";
import {
  applyMysteryEffect,
  type MysteryEffectContext,
  type MysteryEffectResult,
} from "@/features/alchemy/run-loop/navigation/mystery-flow";
import { cardLibrary, getCardKeywords } from "@/lib/game-data";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import * as cardPools from "@/lib/game-data/cards/card-pools";
import { resetAllTestStores, useGearStore, useProfileStore } from "../../../../helpers/gameplay-store-test";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";

function makeContext(rng: () => number = () => 0.5): MysteryEffectContext {
  let context!: MysteryEffectContext;
  dispatchRunSessionCommand((draft) => {
    context = { draft, rng };
  });
  return context;
}

function apply(effect: MysteryEffect, rng: () => number = () => 0.5): MysteryEffectResult {
  let result!: MysteryEffectResult;
  dispatchRunSessionCommand((draft) => {
    result = applyMysteryEffect(effect, { draft, rng });
  });
  return result;
}

const slash = cardLibrary.find((card) => card.id === "slash")!;

beforeEach(() => {
  resetAllTestStores();
  useProfileStore.setState(useProfileStore.getInitialState());
});

describe("applyMysteryEffect", () => {
  it("addCard appends the library card and tracks discovery", () => {
    apply({ kind: "addCard", cardId: "slash" });
    expect(getRunProgressStoreView().runDeck.map((card) => card.id)).toContain("slash");
  });

  it("chooseCard opens the picker and pauses evaluation", () => {
    const result = apply({ kind: "chooseCard" });
    expect(result.followUp).toBe("choose-card");
    expect(getRunSessionStoreView().mysteryCardChoices).not.toBeNull();
  });

  it("healHealth heals up to max health", () => {
    setRunProgress({ runPlayerHealth: 20, runMaxHealth: 30 });
    const result = apply({ kind: "healHealth", amount: 5 });
    expect(result.followUp).toBeNull();
    expect(getRunProgressStoreView().runPlayerHealth).toBe(25);
  });

  it("damageHealth never drops health below zero", () => {
    setRunProgress({ runPlayerHealth: 2 });
    apply({ kind: "damageHealth", amount: 3 });
    expect(getRunProgressStoreView().runPlayerHealth).toBe(0);
  });

  it("gainGold credits gold with the gain sound", () => {
    setRunProgress({ runGold: 20 });
    const result = apply({ kind: "gainGold", amount: 10 });
    expect(result.goldSound).toBe("gain");
    expect(getRunProgressStoreView().runGold).toBe(30);
  });

  it("loseGold spends gold with the spend sound", () => {
    setRunProgress({ runGold: 20 });
    const result = apply({ kind: "loseGold", amount: 5 });
    expect(result.goldSound).toBe("spend");
    expect(getRunProgressStoreView().runGold).toBe(15);
  });

  it("gainXP awards run talent XP for the keyword", () => {
    apply({ kind: "gainXP", keyword: "nature", amount: 1 });
    expect(getRunProgressStoreView().runTalentXP.nature).toBeGreaterThanOrEqual(1);
  });

  it("removeCard removes one deck card at random without opening a picker", () => {
    setRunProgress({ runDeck: [slash] });
    const result = apply({ kind: "removeCard" });
    expect(result.followUp).toBeNull();
    expect(getRunProgressStoreView().runDeck).toEqual([]);
  });

  it("gainTrinket appends unowned trinkets exactly once", () => {
    apply({ kind: "gainTrinket", trinketId: "bone-charm" });
    apply({ kind: "gainTrinket", trinketId: "bone-charm" });
    expect(getRunProgressStoreView().runBoons).toEqual(["bone-charm"]);
  });

  it("gainRandomTrinket grants an unowned pick and records it", () => {
    const result = apply({ kind: "gainRandomTrinket", fromIds: ["bone-charm", "sin-eaters-lantern"] }, () => 0.5);
    expect(result.followUp).toBeNull();
    const granted = getRunSessionStoreView().mysteryGrantedTrinketIds;
    expect(granted).toHaveLength(1);
    expect(["bone-charm", "sin-eaters-lantern"]).toContain(granted[0]);
    expect(getRunProgressStoreView().runBoons).toEqual(granted);
  });

  it("gainRandomTrinket falls back outside fromIds when every candidate is owned", () => {
    setRunProgress({ runBoons: ["bone-charm", "sin-eaters-lantern"] });
    const result = apply({ kind: "gainRandomTrinket", fromIds: ["bone-charm", "sin-eaters-lantern"] }, () => 0.5);
    expect(result.followUp).toBeNull();
    const granted = getRunSessionStoreView().mysteryGrantedTrinketIds;
    expect(granted).toHaveLength(1);
    expect(["bone-charm", "sin-eaters-lantern"]).not.toContain(granted[0]);
  });

  it("gainGeneratedGear adds the instance to the armory and records it", () => {
    setRunProgress({ characterId: "knight" });
    getRunSessionStoreView().setHasActiveRun(true);

    apply({ kind: "gainGeneratedGear", baseItemId: "emerald-ring" });

    const granted = getRunSessionStoreView().mysteryGrantedGearInstances;
    expect(granted).toHaveLength(1);
    expect(granted[0]!.definitionId).toMatch(/^emerald-ring-(basic|astral)$/);
    expect(useGearStore.getState().inventories.knight.some((item) => item.instanceId === granted[0]!.instanceId)).toBe(
      true,
    );
    expect(getRunProgressStoreView().runObtainedItems).toEqual([{ kind: "gear", instance: granted[0] }]);
  });

  it("gainMaterial awards the material during the run", () => {
    apply({ kind: "gainMaterial", material: "wood", amount: 1 });
    expect(getRunProgressStoreView().materialInventory.wood).toBeGreaterThanOrEqual(1);
  });

  it("throws for unknown effect kinds", () => {
    expect(() => applyMysteryEffect({ kind: "unknown-kind" } as unknown as MysteryEffect, makeContext())).toThrow(
      /Unhandled mystery effect kind/,
    );
  });
});

describe("chooseCard tag filtering", () => {
  it("offers only cards matching the tag", () => {
    apply({ kind: "chooseCard", tag: "archery" });
    const offered = getRunSessionStoreView().mysteryCardChoices!;
    expect(offered.length).toBeGreaterThan(0);
    for (const card of offered) {
      const libraryCard = cardLibrary.find((c) => c.id === card.id);
      expect(getCardKeywords(libraryCard ?? card)).toContain("archery");
    }
  });

  it("can offer non-tagged cards when no tag is given", () => {
    apply({ kind: "chooseCard" });
    const offered = getRunSessionStoreView().mysteryCardChoices!;
    expect(offered.some((card) => !getCardKeywords(card).includes("archery"))).toBe(true);
  });

  it("falls back to the full offerable pool when the tag matches nothing", () => {
    const slashOnly = getOfferableCardPool().filter((card) => card.id === "slash");
    expect(slashOnly).toHaveLength(1);
    expect(getCardKeywords(slashOnly[0])).not.toContain("archery");

    const poolSpy = vi.spyOn(cardPools, "getOfferableCardPool").mockReturnValue(slashOnly);
    try {
      apply({ kind: "chooseCard", tag: "archery" });
      const offered = getRunSessionStoreView().mysteryCardChoices!;
      expect(offered.length).toBeGreaterThan(0);
      expect(offered.every((card) => card.id === "slash")).toBe(true);
    } finally {
      poolSpy.mockRestore();
    }
  });
});
