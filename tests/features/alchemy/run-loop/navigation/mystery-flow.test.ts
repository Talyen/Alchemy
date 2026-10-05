import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MysteryEffect } from "@/lib/mystery";
import { applyMysteryEffect, type MysteryEffectResult } from "@/features/alchemy/run-loop/navigation/mystery-flow";
import { cardLibrary, getCardKeywords, trinketLibrary } from "@/lib/game-data";
import * as cardPools from "@/lib/game-data/cards/card-pools";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import { resetAllTestStores, resetProfileForTest } from "../../../../helpers/run-domain-store-test";
import { setRunProgress } from "../../../../helpers/run-domain-store-test";
import { acceptCommand, dispatchRunSessionCommand } from "@/features/alchemy/shared/stores/run-session-command";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
function apply(effect: MysteryEffect, rng: () => number = () => 0.5): MysteryEffectResult {
  let result!: MysteryEffectResult;
  dispatchRunSessionCommand((draft) => {
    result = applyMysteryEffect(effect, { draft, rng });

    return acceptCommand();
  });
  return result;
}

const slash = cardLibrary.find((card) => card.id === "slash")!;

beforeEach(() => {
  resetAllTestStores();
  resetProfileForTest();
});

describe("applyMysteryEffect", () => {
  it("addCard appends the library card and tracks discovery", () => {
    const before = readActiveRun().runDeck.map((card) => card.id);
    apply({ kind: "addCard", cardId: "slash" });
    expect(readActiveRun().runDeck.map((card) => card.id)).toEqual([...before, "slash"]);
    expect(readProfileStore().discoveredCardIds).toContain("slash");
  });

  it("chooseCard opens the picker and pauses evaluation", () => {
    const result = apply({ kind: "chooseCard" });
    expect(result.followUp).toBe("choose-card");
    expect(readActivityData(readRunSession().activity, "mystery").mysteryCardChoices).not.toBeNull();
  });

  it("healHealth heals up to max health", () => {
    setRunProgress({ runPlayerHealth: 20, runMaxHealth: 30 });
    const result = apply({ kind: "healHealth", amount: 5 });
    expect(result.followUp).toBeNull();
    expect(readActiveRun().runPlayerHealth).toBe(25);
    apply({ kind: "healHealth", amount: 20 });
    expect(readActiveRun().runPlayerHealth).toBe(30);
  });

  it("draws randomness only for chance healing and respects the probability boundary", () => {
    setRunProgress({ runPlayerHealth: 20, runMaxHealth: 30 });
    const rng = vi.fn(() => 0.5);
    apply({ kind: "healHealth", amount: 3 }, rng);
    expect(rng).not.toHaveBeenCalled();
    apply({ kind: "healHealth", amount: 3, chance: 0.5 }, rng);
    expect(readActiveRun().runPlayerHealth).toBe(23);
    apply({ kind: "healHealth", amount: 3, chance: 0.51 }, rng);
    expect(readActiveRun().runPlayerHealth).toBe(26);
    expect(rng).toHaveBeenCalledTimes(2);
  });

  it("damageHealth never drops health below zero", () => {
    setRunProgress({ runPlayerHealth: 2 });
    apply({ kind: "damageHealth", amount: 3 });
    expect(readActiveRun().runPlayerHealth).toBe(0);
  });

  it("gainGold credits gold with the gain sound", () => {
    setRunProgress({ gold: 20 });
    const result = apply({ kind: "gainGold", amount: 10 });
    expect(result.goldSound).toBe("gain");
    expect(readRunProfile().gold).toBe(30);
    expect(apply({ kind: "gainGold", amount: 0 }).goldSound).toBeUndefined();
    expect(readRunProfile().gold).toBe(30);
  });

  it("loseGold spends gold with the spend sound", () => {
    setRunProgress({ gold: 20 });
    const result = apply({ kind: "loseGold", amount: 5 });
    expect(result.goldSound).toBe("spend");
    expect(readRunProfile().gold).toBe(15);
    expect(apply({ kind: "loseGold", amount: 0 }).goldSound).toBeUndefined();
    expect(readRunProfile().gold).toBe(15);
  });

  it("gainXP awards run talent XP for the keyword", () => {
    apply({ kind: "gainXP", keyword: "nature", amount: 1 });
    expect(readActiveRun().runTalentXP.nature).toBeGreaterThanOrEqual(1);
  });

  it("removeCard removes one deck card at random without opening a picker", () => {
    const second = cardLibrary.find((card) => card.id === "fireball")!;
    setRunProgress({ runDeck: [slash, second] });
    const rng = vi.fn(() => 0);
    const result = apply({ kind: "removeCard" }, rng);
    expect(result.followUp).toBeNull();
    expect(readActiveRun().runDeck).toEqual([second]);
    apply({ kind: "removeCard" }, rng);
    expect(readActiveRun().runDeck).toEqual([]);
    apply({ kind: "removeCard" }, rng);
    expect(rng).toHaveBeenCalledTimes(2);
  });

  it("gainTrinket appends unowned trinkets exactly once", () => {
    apply({ kind: "gainTrinket", trinketId: "bone-charm" });
    apply({ kind: "gainTrinket", trinketId: "bone-charm" });
    expect(readActiveRun().runBoons).toEqual(["bone-charm"]);
  });

  it("gainRandomTrinket grants an unowned pick and records it", () => {
    const result = apply({ kind: "gainRandomTrinket", fromIds: ["bone-charm", "sin-eaters-lantern"] }, () => 0.5);
    expect(result.followUp).toBeNull();
    const granted = readActivityData(readRunSession().activity, "mystery").mysteryGrantedTrinketIds;
    expect(granted).toHaveLength(1);
    expect(["bone-charm", "sin-eaters-lantern"]).toContain(granted[0]);
    expect(readActiveRun().runBoons).toEqual(granted);
  });

  it("gainRandomTrinket falls back outside fromIds when every candidate is owned", () => {
    setRunProgress({ runBoons: ["bone-charm", "sin-eaters-lantern"] });
    const result = apply({ kind: "gainRandomTrinket", fromIds: ["bone-charm", "sin-eaters-lantern"] }, () => 0.5);
    expect(result.followUp).toBeNull();
    const granted = readActivityData(readRunSession().activity, "mystery").mysteryGrantedTrinketIds;
    expect(granted).toHaveLength(1);
    expect(["bone-charm", "sin-eaters-lantern"]).not.toContain(granted[0]);
  });

  it("gainRandomTrinket falls back to guaranteed-Astral gear when every trinket is owned", () => {
    setRunProgress({ characterId: "knight", runBoons: trinketLibrary.map((entry) => entry.id) });
    dispatchRunSessionCommand((draft) => acceptCommand(setHasActiveRun(draft, true)));

    const result = apply({ kind: "gainRandomTrinket", fromIds: ["bone-charm"] }, () => 0.5);
    expect(result.followUp).toBeNull();
    expect(readActivityData(readRunSession().activity, "mystery").mysteryGrantedTrinketIds).toEqual([]);
    const gear = readActivityData(readRunSession().activity, "mystery").mysteryGrantedGearInstances;
    expect(gear).toHaveLength(1);
    expect(gear[0]?.definitionId).toMatch(/-astral$/);
  });

  it("uses shared depth eligibility for random Gear while honoring an already-promised Astral", () => {
    setRunProgress({ characterId: "knight", destinationIndexInAct: 0 });
    apply({ kind: "gainGeneratedGear", baseItemId: "emerald-ring" }, () => 0.99);
    expect(
      readActivityData(readRunSession().activity, "mystery").mysteryGrantedGearInstances.at(-1)?.definitionId,
    ).toBe("emerald-ring-basic");
    setRunProgress({ destinationIndexInAct: 3 });
    apply({ kind: "gainGeneratedGear", baseItemId: "emerald-ring" }, () => 0.99);
    expect(
      readActivityData(readRunSession().activity, "mystery").mysteryGrantedGearInstances.at(-1)?.definitionId,
    ).toBe("emerald-ring-astral");
    setRunProgress({ destinationIndexInAct: 0 });
    apply({ kind: "gainGeneratedGear", baseItemId: "emerald-ring", astral: true }, () => 0);
    expect(
      readActivityData(readRunSession().activity, "mystery").mysteryGrantedGearInstances.at(-1)?.definitionId,
    ).toBe("emerald-ring-astral");
  });

  it("gainGeneratedGear adds the instance to the armory and records it", () => {
    setRunProgress({ characterId: "knight" });
    dispatchRunSessionCommand((draft) => acceptCommand(setHasActiveRun(draft, true)));

    apply({ kind: "gainGeneratedGear", baseItemId: "emerald-ring" });

    const granted = readActivityData(readRunSession().activity, "mystery").mysteryGrantedGearInstances;
    expect(granted).toHaveLength(1);
    expect(granted[0]!.definitionId).toMatch(/^emerald-ring-(basic|astral)$/);
    expect(readGearState().inventories.knight.some((item) => item.instanceId === granted[0]!.instanceId)).toBe(true);
    expect(readActiveRun().runObtainedItems).toEqual([{ kind: "gear", instance: granted[0] }]);
  });

  it("gainRandomGear adds a generated non-unique instance to the armory and records it", () => {
    setRunProgress({ characterId: "knight" });
    dispatchRunSessionCommand((draft) => acceptCommand(setHasActiveRun(draft, true)));

    apply({ kind: "gainRandomGear" }, () => 0.5);

    const granted = readActivityData(readRunSession().activity, "mystery").mysteryGrantedGearInstances;
    expect(granted).toHaveLength(1);
    expect(granted[0]!.definitionId).toMatch(/-(basic|astral)$/);
    expect(readGearState().inventories.knight.some((item) => item.instanceId === granted[0]!.instanceId)).toBe(true);
    expect(readActiveRun().runObtainedItems).toEqual([{ kind: "gear", instance: granted[0] }]);
  });

  it("gainMaterial awards the material during the run", () => {
    const before = readRunProfile().materialInventory.wood;
    const result = apply({ kind: "gainMaterial", material: "wood", amount: 3 });
    expect(readRunProfile().materialInventory.wood).toBe(before + 3);
    expect(readActiveRun().runMaterialsEarned.wood).toBe(3);
    expect(result.materialAward).toEqual({ material: "wood", amount: 3 });
  });
});

describe("chooseCard tag filtering", () => {
  it("offers only cards matching the tag", () => {
    apply({ kind: "chooseCard", tag: "archery" });
    const offered = readActivityData(readRunSession().activity, "mystery").mysteryCardChoices!;
    expect(offered.length).toBeGreaterThan(0);
    for (const card of offered) {
      const libraryCard = cardLibrary.find((c) => c.id === card.id);
      expect(getCardKeywords(libraryCard ?? card)).toContain("archery");
    }
  });

  it("can offer non-tagged cards when no tag is given", () => {
    apply({ kind: "chooseCard" });
    const offered = readActivityData(readRunSession().activity, "mystery").mysteryCardChoices!;
    expect(offered.some((card) => !getCardKeywords(card).includes("archery"))).toBe(true);
  });

  it("falls back to the full offerable pool when the tag matches nothing", () => {
    const slashOnly = getOfferableCardPool().filter((card) => card.id === "slash");
    expect(slashOnly).toHaveLength(1);
    expect(getCardKeywords(slashOnly[0])).not.toContain("archery");

    const poolSpy = vi.spyOn(cardPools, "getOfferableCardPool").mockReturnValue(slashOnly);
    try {
      apply({ kind: "chooseCard", tag: "archery" });
      const offered = readActivityData(readRunSession().activity, "mystery").mysteryCardChoices!;
      expect(offered.length).toBeGreaterThan(0);
      expect(offered.every((card) => card.id === "slash")).toBe(true);
    } finally {
      poolSpy.mockRestore();
    }
  });
});
