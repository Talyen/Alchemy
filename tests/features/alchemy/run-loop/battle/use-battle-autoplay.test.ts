// @vitest-environment jsdom
import { useRef } from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAutoplayBlocked, useBattleAutoplay } from "@/features/alchemy/run-loop/battle/use-battle-autoplay";
import { useBattlePresentationGateRef } from "@/features/alchemy/run-loop/battle/use-battle-presentation-gate";
import { useBattlePresentationStore } from "@/features/alchemy/run-loop/battle/battle-presentation-store";
import { resetBattlePresentationAndRun } from "./battle-test-reset";
import { AUTOPLAY_RETRY_DELAY_MS } from "@/lib/game-constants";
import { makeOpenBattle } from "./open-battle-fixture";

const openBattle = makeOpenBattle({ gameMenuOpen: false });

describe("isAutoplayBlocked", () => {
  it("blocks when the game menu is open", () => {
    expect(isAutoplayBlocked({ ...openBattle, gameMenuOpen: true })).toBe(true);
  });
});

function useAutoplayUnderTest(
  options: Omit<Parameters<typeof useBattleAutoplay>[0], "presentationGateRef" | "wakeRef">,
) {
  const wakeRef = useRef<(() => void) | null>(null);
  const onGateChangeRef = useRef(() => {
    wakeRef.current?.();
  });
  const presentationGateRef = useBattlePresentationGateRef(onGateChangeRef);
  useBattleAutoplay({ ...options, presentationGateRef, wakeRef });
}

describe("useBattleAutoplay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resetBattlePresentationAndRun();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("plays the first playable card when enabled", () => {
    const playCard = vi.fn(() => true);
    renderHook(() =>
      useAutoplayUnderTest({
        enabled: true,
        screen: "battle",
        battleState: openBattle.battleState,
        hasActiveBattle: true,
        isCardPlayInProgress: () => false,
        gameMenuOpen: false,
        playCard,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_RETRY_DELAY_MS);
    });

    expect(playCard).toHaveBeenCalled();
  });

  it("does not play while blocked by hidden cards", () => {
    const playCard = vi.fn(() => true);
    useBattlePresentationStore.setState({ hiddenHandCardKeys: ["slash-1"] });
    renderHook(() =>
      useAutoplayUnderTest({
        enabled: true,
        screen: "battle",
        battleState: openBattle.battleState,
        hasActiveBattle: true,
        isCardPlayInProgress: () => false,
        gameMenuOpen: false,
        playCard,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(AUTOPLAY_RETRY_DELAY_MS * 3);
    });

    expect(playCard).not.toHaveBeenCalled();
  });

  it("plays immediately when a blocking transfer completes", async () => {
    const playCard = vi.fn(() => true);
    useBattlePresentationStore.setState({ cardTransferInProgress: true });
    renderHook(() =>
      useAutoplayUnderTest({
        enabled: true,
        screen: "battle",
        battleState: openBattle.battleState,
        hasActiveBattle: true,
        isCardPlayInProgress: () => false,
        gameMenuOpen: false,
        playCard,
      }),
    );

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(playCard).not.toHaveBeenCalled();

    await act(async () => {
      useBattlePresentationStore.setState({ cardTransferInProgress: false });
      await Promise.resolve();
    });

    expect(playCard).toHaveBeenCalled();
  });
});
