import { defaultHomesteadEffects } from "@/lib/homestead/defaults";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MysteryEffect } from "@/lib/mystery";
import { applyMysteryEffect, type MysteryEffectResult } from "@/features/alchemy/run-loop/navigation/mystery-flow";
import { cardLibrary, getCardKeywords } from "@/lib/game-data";
import * as cardPools from "@/lib/game-data/cards/card-pools";
import { getOfferableCardPool } from "@/lib/game-data/cards/card-pools";
import {
  mutateRunForTest,
  resetAllTestStores,
  resetProfileForTest,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { readActiveRun, readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { readProfileStore } from "@/features/alchemy/shared/stores/profile-store";
import { readGearState } from "@/features/alchemy/shared/stores/gear-store";
import { setHasActiveRun } from "@/features/alchemy/shared/stores/run-session-write-port";
import { readActivityData } from "@/lib/active-run-session";
import { defaultGameSession } from "@/app/application-session";
function apply(effect: MysteryEffect, rng: () => number = () => 0.5): MysteryEffectResult {
  let result!: MysteryEffectResult;
  mutateRunForTest((draft) => {
    result = applyMysteryEffect(effect, { draft, rng });
  });
  return result;
}

beforeEach(() => {
  resetAllTestStores();
  resetProfileForTest();
});

describe("applyMysteryEffect", () => {
  it("addCard appends the library card and tracks discovery", () => {
    const before = readActiveRun(defaultGameSession).runDeck.map((card) => card.id);
    apply({ kind: "addCard", cardId: "slash" });
    expect(readActiveRun(defaultGameSession).runDeck.map((card) => card.id)).toEqual([...before, "slash"]);
    expect(readProfileStore(defaultGameSession).discoveredCardIds).toContain("slash");
  });

  it("chooseCard opens the picker and pauses evaluation", () => {
    const result = apply({ kind: "chooseCard" });
    expect(result.followUp).toBe("choose-card");
    expect(readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryCardChoices).not.toBeNull();
  });

  it("healHealth heals up to max health", () => {
    setRunProgress({ runPlayerHealth: 20, runMaxHealth: 30 });
    const result = apply({ kind: "healHealth", amount: 5 });
    expect(result.followUp).toBeNull();
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(25);
    apply({ kind: "healHealth", amount: 20 });
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(30);
  });

  it("adds Culinary Arts to positive Mystery healing without creating healing from zero", () => {
    setRunProgress({
      runPlayerHealth: 10,
      runMaxHealth: 30,
      effects: { ...defaultHomesteadEffects, homesteadHealing: 3 },
    });
    apply({ kind: "healHealth", amount: 5 });
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(18);
    apply({ kind: "healHealth", amount: 0 });
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(18);
    apply({ kind: "healHealth", amount: 20 });
    expect(readActiveRun(defaultGameSession).runPlayerHealth).toBe(30);
  });

  it("gainGold credits gold with the gain sound", () => {
    setRunProgress({ gold: 20 });
    const result = apply({ kind: "gainGold", amount: 10 });
    expect(result.goldSound).toBe("gain");
    expect(readRunProfile(defaultGameSession).gold).toBe(30);
    expect(apply({ kind: "gainGold", amount: 0 }).goldSound).toBeUndefined();
    expect(readRunProfile(defaultGameSession).gold).toBe(30);
  });

  it("boosts Mystery payouts before writing their exact quantities to wallets and run tallies", () => {
    setRunProgress({ gold: 50, effects: { ...defaultHomesteadEffects, woodFindBonus: 0.4, goldFindBonus: 0.4 } });
    const result = apply({ kind: "gainMaterial", material: "wood", amount: 10 });
    expect(result.materialAward).toEqual({ material: "wood", amount: 14 });
    expect(readRunProfile(defaultGameSession).materialInventory.wood).toBe(14);
    expect(readActiveRun(defaultGameSession).runMaterialsEarned.wood).toBe(14);
    expect(apply({ kind: "gainGold", amount: 10 }).goldAward).toBe(14);
    expect(readRunProfile(defaultGameSession).gold).toBe(64);
    apply({ kind: "gainGold", amount: 0 });
    expect(readRunProfile(defaultGameSession).gold).toBe(64);
  });

  it("gainXP awards run talent XP for the keyword", () => {
    apply({ kind: "gainXP", keyword: "nature", amount: 1 });
    expect(readActiveRun(defaultGameSession).runTalentXP.nature).toBeGreaterThanOrEqual(1);
  });

  it("gainTrinket appends unowned trinkets exactly once", () => {
    apply({ kind: "gainTrinket", trinketId: "bone-charm" });
    apply({ kind: "gainTrinket", trinketId: "bone-charm" });
    expect(readActiveRun(defaultGameSession).runBoons).toEqual(["bone-charm"]);
  });

  it("uses shared depth eligibility for random Gear while honoring an already-promised Astral", () => {
    setRunProgress({ characterId: "knight", destinationIndexInAct: 0 });
    apply({ kind: "gainGeneratedGear", baseItemId: "emerald-ring" }, () => 0.99);
    expect(
      readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryGrantedGearInstances.at(-1)
        ?.definitionId,
    ).toBe("emerald-ring-basic");
    setRunProgress({ destinationIndexInAct: 3 });
    apply({ kind: "gainGeneratedGear", baseItemId: "emerald-ring" }, () => 0.99);
    expect(
      readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryGrantedGearInstances.at(-1)
        ?.definitionId,
    ).toBe("emerald-ring-astral");
    setRunProgress({ destinationIndexInAct: 0 });
    apply({ kind: "gainGeneratedGear", baseItemId: "emerald-ring", astral: true }, () => 0);
    expect(
      readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryGrantedGearInstances.at(-1)
        ?.definitionId,
    ).toBe("emerald-ring-astral");
  });

  it("gainGeneratedGear adds the instance to the armory and records it", () => {
    setRunProgress({ characterId: "knight" });
    mutateRunForTest((draft) => setHasActiveRun(draft, true));

    apply({ kind: "gainGeneratedGear", baseItemId: "emerald-ring" });

    const granted = readActivityData(
      readRunSession(defaultGameSession).activity,
      "mystery",
    ).mysteryGrantedGearInstances;
    expect(granted).toHaveLength(1);
    expect(granted[0]!.definitionId).toMatch(/^emerald-ring-(basic|astral)$/);
    expect(
      readGearState(defaultGameSession).inventories.knight.some((item) => item.instanceId === granted[0]!.instanceId),
    ).toBe(true);
    expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([{ kind: "gear", instance: granted[0] }]);
  });

  it("gainRandomGear adds a generated non-unique instance to the armory and records it", () => {
    setRunProgress({ characterId: "knight" });
    mutateRunForTest((draft) => setHasActiveRun(draft, true));

    apply({ kind: "gainRandomGear" }, () => 0.5);

    const granted = readActivityData(
      readRunSession(defaultGameSession).activity,
      "mystery",
    ).mysteryGrantedGearInstances;
    expect(granted).toHaveLength(1);
    expect(granted[0]!.definitionId).toMatch(/-(basic|astral)$/);
    expect(
      readGearState(defaultGameSession).inventories.knight.some((item) => item.instanceId === granted[0]!.instanceId),
    ).toBe(true);
    expect(readActiveRun(defaultGameSession).runObtainedItems).toEqual([{ kind: "gear", instance: granted[0] }]);
  });

  it("gainMaterial awards the material during the run", () => {
    const before = readRunProfile(defaultGameSession).materialInventory.wood;
    const result = apply({ kind: "gainMaterial", material: "wood", amount: 3 });
    expect(readRunProfile(defaultGameSession).materialInventory.wood).toBe(before + 3);
    expect(readActiveRun(defaultGameSession).runMaterialsEarned.wood).toBe(3);
    expect(result.materialAward).toEqual({ material: "wood", amount: 3 });
  });
});

describe("chooseCard tag filtering", () => {
  it("offers only cards matching the tag", () => {
    apply({ kind: "chooseCard", tag: "archery" });
    const offered = readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryCardChoices!;
    expect(offered.length).toBeGreaterThan(0);
    for (const card of offered) {
      const libraryCard = cardLibrary.find((c) => c.id === card.id);
      expect(getCardKeywords(libraryCard ?? card)).toContain("archery");
    }
  });

  it("can offer non-tagged cards when no tag is given", () => {
    apply({ kind: "chooseCard" });
    const offered = readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryCardChoices!;
    expect(offered.some((card) => !getCardKeywords(card).includes("archery"))).toBe(true);
  });

  it("falls back to the full offerable pool when the tag matches nothing", () => {
    const slashOnly = getOfferableCardPool().filter((card) => card.id === "slash");
    expect(slashOnly).toHaveLength(1);
    expect(getCardKeywords(slashOnly[0])).not.toContain("archery");

    using _poolSpy = vi.spyOn(cardPools, "getOfferableCardPool").mockReturnValue(slashOnly);

    apply({ kind: "chooseCard", tag: "archery" });
    const offered = readActivityData(readRunSession(defaultGameSession).activity, "mystery").mysteryCardChoices!;
    expect(offered.length).toBeGreaterThan(0);
    expect(offered.every((card) => card.id === "slash")).toBe(true);
  });
});

it("does not treat inherited object keys in a saved Mystery reward as cards", () => {
  const before = readActiveRun(defaultGameSession).runDeck;
  expect(() => apply({ kind: "addCard", cardId: "constructor" })).not.toThrow();
  expect(readActiveRun(defaultGameSession).runDeck).toEqual(before);
  apply({ kind: "addCard", cardId: "slash" });
  expect(readActiveRun(defaultGameSession).runDeck.at(-1)?.id).toBe("slash");
});
