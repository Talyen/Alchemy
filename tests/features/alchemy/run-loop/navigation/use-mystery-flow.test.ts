// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMysteryFlow } from "@/features/alchemy/run-loop/navigation/use-mystery-flow";
import { resetTransientRunUi } from "@/features/alchemy/shared/stores/reset";
import { useProfileStore } from "../../../../helpers/gameplay-store-test";
import {
  getRunProgressStoreView,
  getRunSessionStoreView,
  resetRunProgressSlice,
  setRunProgress,
} from "../../../../helpers/run-domain-store-test";
import { subscribeRunSessionCommits } from "@/features/alchemy/shared/stores/run-session-command";
import type { MysteryEffect } from "@/lib/mystery";

vi.mock("@/lib/audio", () => ({
  playGoldGain: vi.fn(),
  playGoldSpend: vi.fn(),
}));

import { playGoldGain, playGoldSpend } from "@/lib/audio";

beforeEach(() => {
  vi.clearAllMocks();
  resetTransientRunUi();
  resetRunProgressSlice();
  useProfileStore.setState(useProfileStore.getInitialState());
});

describe("useMysteryFlow", () => {
  it("beginMysteryEvent stores an event and navigates", () => {
    const navigate = vi.fn();
    const { result } = renderHook(() => useMysteryFlow());

    act(() => {
      result.current.beginMysteryEvent(navigate);
    });

    expect(getRunSessionStoreView().mysteryEvent).not.toBeNull();
    expect(getRunSessionStoreView().mysteryCardChoices).toBeNull();
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("handleMysteryChoice applies heal effects without follow-up", () => {
    const { result } = renderHook(() => useMysteryFlow());
    const healthBefore = getRunProgressStoreView().runPlayerHealth;

    act(() => {
      result.current.handleMysteryChoice({
        label: "Rest",
        effects: [{ kind: "healHealth", amount: 5 }],
      });
    });

    expect(getRunProgressStoreView().runPlayerHealth).toBe(
      Math.min(getRunProgressStoreView().runMaxHealth, healthBefore + 5),
    );
  });

  it("handleMysteryChoice stops when chooseCard requires follow-up UI", () => {
    const { result } = renderHook(() => useMysteryFlow());

    act(() => {
      result.current.handleMysteryChoice({
        label: "Browse",
        effects: [{ kind: "chooseCard" }],
      });
    });

    expect(getRunSessionStoreView().mysteryCardChoices).not.toBeNull();
  });

  it("plays gold sounds only after the choice commits", () => {
    setRunProgress({ runGold: 20 });
    const { result } = renderHook(() => useMysteryFlow());
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

  it("rolls back state and skips gold sounds when a later effect throws", () => {
    setRunProgress({ runGold: 20 });
    const { result } = renderHook(() => useMysteryFlow());

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
});
