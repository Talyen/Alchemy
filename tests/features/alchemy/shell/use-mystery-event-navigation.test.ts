import "../../../helpers/mock-audio";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMysteryEventNavigation } from "@/features/alchemy/shell/use-mystery-event-navigation";
import { resetAllTestStores, resetProfileForTest } from "../../../helpers/gameplay-store-test";
import { setRunProgress } from "../../../helpers/run-domain-store-test";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import { readRunProfile, readRunSession } from "@/features/alchemy/shared/stores/run-reads";
import { type MysteryEffect } from "@/lib/mystery";

import { playGoldGain, playGoldSpend, playUISound } from "@/lib/audio";
import { ROUTE_SCREENS, type Screen } from "@/lib/routing";

function renderMysteryNav(navigateTo = vi.fn((_screen: Screen, onCommit?: () => void) => onCommit?.())) {
  const hook = renderHook(() => useMysteryEventNavigation({ navigateTo }));
  return { ...hook, navigateTo };
}

beforeEach(() => {
  resetAllTestStores();
  resetProfileForTest();
});

describe("useMysteryEventNavigation", () => {
  it("beginMysteryEvent stores an event and navigates", () => {
    const { result, navigateTo } = renderMysteryNav();

    act(() => {
      result.current.beginMysteryEvent();
    });

    expect(readRunSession().mysteryEvent).not.toBeNull();
    expect(readRunSession().mysteryCardChoices).toBeNull();
    expect(readRunSession().mysteryGrantedTrinketIds).toEqual([]);
    expect(readRunSession().mysteryGrantedGearInstances).toEqual([]);
    expect(readRunSession().mysteryChosenCardId).toBeNull();
    expect(readRunSession().mysteryChosenChoice).toBeNull();
    expect(navigateTo).toHaveBeenCalledWith(ROUTE_SCREENS.MYSTERY, undefined);
    expect(playUISound).toHaveBeenCalledWith("musicBoxMystery");
  });

  it("plays gold sounds only after the choice commits", () => {
    setRunProgress({ gold: 20 });
    const { result } = renderMysteryNav();
    const commits: number[] = [];
    const unsubscribe = subscribeRunSessionCommits((revision) => commits.push(revision));
    vi.mocked(playGoldGain).mockImplementationOnce(() => {
      expect(readRunProfile().gold).toBe(25);
    });
    vi.mocked(playGoldSpend).mockImplementationOnce(() => {
      expect(readRunProfile().gold).toBe(25);
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
    setRunProgress({ gold: 20 });
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

    expect(readRunProfile().gold).toBe(30);
    expect(readRunSession().mysteryChosenChoice?.label).toBe("Take");
  });

  it("handleMysteryChooseCard ignores a second pick", async () => {
    const { result } = renderMysteryNav();

    const { dispatchRunSessionCommand } = await import("@/features/alchemy/shared/stores/run-session-command");
    const { setMysteryCardChoices } = await import("@/features/alchemy/shared/stores/run-session-write-port");
    const { cardById } = await import("@/lib/game-data");
    act(() => {
      dispatchRunSessionCommand((draft) => {
        setMysteryCardChoices(draft, [cardById["slash"], cardById["block"]].filter(Boolean) as never);
      });
    });

    act(() => {
      result.current.handleMysteryChooseCard("slash");
      result.current.handleMysteryChooseCard("block");
    });

    expect(readRunSession().mysteryChosenCardId).toBe("slash");
  });

  it("rolls back state and skips gold sounds when a later effect throws", () => {
    setRunProgress({ gold: 20 });
    const { result } = renderMysteryNav();

    expect(() =>
      act(() => {
        result.current.handleMysteryChoice({
          label: "Broken",
          effects: [{ kind: "gainGold", amount: 10 }, { kind: "unknown-kind" } as unknown as MysteryEffect],
        });
      }),
    ).toThrow(/Unhandled mystery effect kind/);

    expect(readRunProfile().gold).toBe(20);
    expect(playGoldGain).not.toHaveBeenCalled();
    expect(playGoldSpend).not.toHaveBeenCalled();
  });
});
