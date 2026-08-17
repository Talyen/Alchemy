// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { useBattlePlayback } from "@/app/screen-routes/use-battle-playback";
import { useSettingsStore } from "@/features/alchemy/shared/stores/settings-store";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { makeTestBattleState } from "../fixtures/battle";

function renderPlayback(
  overrides: Partial<Parameters<typeof useBattlePlayback>[0]> = {},
  options?: { initialAutoplay?: boolean },
) {
  return renderHook(() => {
    const [isAutoplayEnabled, setAutoplayEnabled] = useState(options?.initialAutoplay ?? false);
    const playback = useBattlePlayback({
      screen: "battle",
      battleState: makeTestBattleState(),
      hasActiveBattle: true,
      gameMenuOpen: false,
      isAutoplayEnabled,
      setAutoplayEnabled,
      handleEndTurn: vi.fn(),
      handleAutoplayCard: vi.fn(() => false),
      isCardPlayInProgress: () => false,
      ...overrides,
      ...(overrides.isAutoplayEnabled === undefined ? {} : { isAutoplayEnabled: overrides.isAutoplayEnabled }),
      ...(overrides.setAutoplayEnabled === undefined ? {} : { setAutoplayEnabled: overrides.setAutoplayEnabled }),
    });
    return playback;
  });
}

describe("useBattlePlayback", () => {
  beforeEach(() => {
    useSettingsStore.setState(useSettingsStore.getInitialState(), true);
    useBattlePresentationStore.setState(useBattlePresentationStore.getInitialState());
  });

  it("starts with preferred autoplay off when remember is off", () => {
    const { result } = renderPlayback();
    expect(result.current.isAutoplayEnabled).toBe(false);
  });

  it("toggles autoplay without persisting when remember is off", () => {
    const { result } = renderPlayback();
    act(() => {
      result.current.toggleAutoplay();
    });
    expect(result.current.isAutoplayEnabled).toBe(true);
    expect(useSettingsStore.getState().autoplayEnabled).toBe(false);
  });

  it("keeps a session toggle across unmount when the owner state survives", () => {
    const owner = { enabled: false };
    const { result, unmount } = renderHook(() => {
      const [isAutoplayEnabled, setAutoplayEnabled] = useState(owner.enabled);
      owner.enabled = isAutoplayEnabled;
      return useBattlePlayback({
        screen: "battle",
        battleState: makeTestBattleState(),
        hasActiveBattle: true,
        gameMenuOpen: false,
        isAutoplayEnabled,
        setAutoplayEnabled: (enabled) => {
          owner.enabled = enabled;
          setAutoplayEnabled(enabled);
        },
        handleEndTurn: vi.fn(),
        handleAutoplayCard: vi.fn(() => false),
        isCardPlayInProgress: () => false,
      });
    });

    act(() => {
      result.current.toggleAutoplay();
    });
    expect(owner.enabled).toBe(true);
    unmount();

    const remounted = renderHook(() =>
      useBattlePlayback({
        screen: "battle",
        battleState: makeTestBattleState(),
        hasActiveBattle: true,
        gameMenuOpen: false,
        isAutoplayEnabled: owner.enabled,
        setAutoplayEnabled: (enabled) => {
          owner.enabled = enabled;
        },
        handleEndTurn: vi.fn(),
        handleAutoplayCard: vi.fn(() => false),
        isCardPlayInProgress: () => false,
      }),
    );
    expect(remounted.result.current.isAutoplayEnabled).toBe(true);
  });
});
