// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMysteryEventNavigation } from "@/features/alchemy/shell/use-mystery-event-navigation";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { useProfileStore } from "../../../helpers/gameplay-store-test";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
  setRunProgress,
} from "../../../helpers/run-domain-store-test";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { findMysteryEvent, type MysteryEffect } from "@/lib/mystery";
import * as mystery from "@/lib/mystery";
import { gearDefinitions } from "@/lib/gear";
import { useGearStore } from "../../../helpers/gameplay-store-test";
import { makeTestCard } from "../../../fixtures/cards";
import { CONSTANTS } from "@/features/alchemy/shared/types";
import type { Screen } from "@/lib/routing";

vi.mock("@/lib/audio", () => ({
  playGoldGain: vi.fn(),
  playGoldSpend: vi.fn(),
  playUISound: vi.fn(),
}));

import { playGoldGain, playGoldSpend, playUISound } from "@/lib/audio";

function renderMysteryNav(navigateTo = vi.fn((_screen: Screen, onCommit?: () => void) => onCommit?.())) {
  const hook = renderHook(() => useMysteryEventNavigation({ navigateTo }));
  return { ...hook, navigateTo };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  resetTransientRunUi();
  resetRunProgressSlice();
  useProfileStore.setState(useProfileStore.getInitialState());
});

describe("useMysteryEventNavigation", () => {
  it("beginMysteryEvent stores an event and navigates", () => {
    const { result, navigateTo } = renderMysteryNav();

    act(() => {
      result.current.beginMysteryEvent();
    });

    expect(getRunSessionStoreView().mysteryEvent).not.toBeNull();
    expect(getRunSessionStoreView().mysteryCardChoices).toBeNull();
    expect(getRunSessionStoreView().mysteryGrantedTrinketIds).toEqual([]);
    expect(getRunSessionStoreView().mysteryGrantedGearInstances).toEqual([]);
    expect(getRunSessionStoreView().mysteryChosenCardId).toBeNull();
    expect(getRunSessionStoreView().mysteryChosenChoice).toBeNull();
    expect(getRunSessionStoreView().mysteryPendingRemoval).toBe(false);
    expect(navigateTo).toHaveBeenCalledWith(CONSTANTS.SCREENS.MYSTERY, undefined);
    expect(playUISound).toHaveBeenCalledWith("musicBoxMystery");
  });

  it("beginMysteryEvent shows an unowned fallback on owned trinket choices", () => {
    const spring = findMysteryEvent("enchanted-spring");
    if (!spring) throw new Error("enchanted-spring is missing from the mystery pool");
    vi.spyOn(mystery, "pickMysteryEvent").mockReturnValue(spring);
    setRunProgress({ runTrinkets: ["icy-heart"] });
    const { result } = renderMysteryNav();

    act(() => {
      result.current.beginMysteryEvent();
    });

    const charm = getRunSessionStoreView().mysteryEvent?.choices.find((choice) => choice.label === "Take the Charm");
    const trinket = charm?.effects.find((effect) => effect.kind === "gainTrinket");
    expect(trinket?.kind).toBe("gainTrinket");
    if (trinket?.kind !== "gainTrinket") return;
    expect(trinket.trinketId).not.toBe("icy-heart");
  });

  it("handleMysteryChoice stops when chooseCard requires follow-up UI", () => {
    const { result } = renderMysteryNav();

    act(() => {
      result.current.handleMysteryChoice({
        label: "Browse",
        effects: [{ kind: "chooseCard" }],
      });
    });

    expect(getRunSessionStoreView().mysteryCardChoices).not.toBeNull();
    expect(getRunSessionStoreView().mysteryChosenChoice?.label).toBe("Browse");
    expect(getRunSessionStoreView().mysteryPendingRemoval).toBe(false);
  });

  it("handleMysteryChoice marks choose-mode removal as pending", () => {
    const { result } = renderMysteryNav();

    act(() => {
      result.current.handleMysteryChoice({
        label: "Offer",
        effects: [{ kind: "removeCard", mode: "choose" }],
      });
    });

    expect(getRunSessionStoreView().mysteryChosenChoice?.label).toBe("Offer");
    expect(getRunSessionStoreView().mysteryPendingRemoval).toBe(true);
  });

  it("handleMysteryChooseCard stores the picked card id for the summary", () => {
    const { result } = renderMysteryNav();

    act(() => {
      result.current.handleMysteryChooseCard("slash");
    });

    expect(getRunSessionStoreView().mysteryChosenCardId).toBe("slash");
    expect(getRunSessionStoreView().mysteryCardChoices).toBeNull();
  });

  it("plays gold sounds only after the choice commits", () => {
    setRunProgress({ runGold: 20 });
    const { result } = renderMysteryNav();
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    vi.mocked(playGoldGain).mockImplementationOnce(() => {
      expect(getRunProgressStoreView().runGold).toBe(25);
    });
    vi.mocked(playGoldSpend).mockImplementationOnce(() => {
      expect(getRunProgressStoreView().runGold).toBe(25);
    });

    act(() => {
      result.current.handleMysteryChoice({
        label: "Trade",
        effects: [
          { kind: "gainGold", amount: 10 },
          { kind: "loseGold", amount: 5 },
        ],
      });
    });
    unsubscribe();

    expect(commits).toHaveLength(1);
    expect(playGoldGain).toHaveBeenCalledOnce();
    expect(playGoldSpend).toHaveBeenCalledOnce();
  });

  it("handleMysteryChoice ignores a second call after the choice commits", () => {
    setRunProgress({ runGold: 20 });
    const { result } = renderMysteryNav();

    act(() => {
      result.current.handleMysteryChoice({
        label: "Take",
        effects: [{ kind: "gainGold", amount: 10 }],
      });
      result.current.handleMysteryChoice({
        label: "Take again",
        effects: [{ kind: "gainGold", amount: 10 }],
      });
    });

    expect(getRunProgressStoreView().runGold).toBe(30);
    expect(getRunSessionStoreView().mysteryChosenChoice?.label).toBe("Take");
  });

  it("handleMysteryChooseCard ignores a second pick", () => {
    const { result } = renderMysteryNav();

    act(() => {
      result.current.handleMysteryChooseCard("slash");
      result.current.handleMysteryChooseCard("block");
    });

    expect(getRunSessionStoreView().mysteryChosenCardId).toBe("slash");
  });

  it("handleMysteryRemoveCard ignores a second removal", () => {
    setRunProgress({
      runDeck: [makeTestCard({ id: "slash" }), makeTestCard({ id: "block" })],
    });
    const { result } = renderMysteryNav();

    act(() => {
      result.current.handleMysteryChoice({
        label: "Offer",
        effects: [{ kind: "removeCard", mode: "choose" }],
      });
      result.current.handleMysteryRemoveCard(0);
      result.current.handleMysteryRemoveCard(0);
    });

    expect(getRunProgressStoreView().runDeck.map((card) => card.id)).toEqual(["block"]);
    expect(getRunSessionStoreView().mysteryPendingRemoval).toBe(false);
  });

  it("rolls back state and skips gold sounds when a later effect throws", () => {
    setRunProgress({ runGold: 20 });
    const { result } = renderMysteryNav();

    expect(() =>
      act(() => {
        result.current.handleMysteryChoice({
          label: "Broken",
          effects: [{ kind: "gainGold", amount: 10 }, { kind: "unknown-kind" } as unknown as MysteryEffect],
        });
      }),
    ).toThrow(/Unhandled mystery effect kind/);

    expect(getRunProgressStoreView().runGold).toBe(20);
    expect(playGoldGain).not.toHaveBeenCalled();
    expect(playGoldSpend).not.toHaveBeenCalled();
  });

  it("grants generated gear into the armory inventory", () => {
    setRunProgress({ characterId: "knight" });
    getRunSessionStoreView().setHasActiveRun(true);
    const { result } = renderMysteryNav();

    act(() => {
      result.current.handleMysteryChoice({
        label: "Claim the Relic",
        effects: [{ kind: "gainGeneratedGear", baseItemId: "topaz-amulet" }],
      });
    });

    const granted = getRunSessionStoreView().mysteryGrantedGearInstances;
    expect(granted).toHaveLength(1);
    expect(gearDefinitions[granted[0]!.definitionId]?.baseItemId).toBe("topaz-amulet");
    expect(useGearStore.getState().inventories.knight.some((item) => item.instanceId === granted[0]!.instanceId)).toBe(
      true,
    );
  });
});
